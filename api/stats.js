export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = process.env.GITHUB_TOKEN;
  const owner = 'justinnewbold';
  const repo = 'images';

  // GET - Get analytics
  if (req.method === 'GET') {
    try {
      // Get all folders
      const foldersResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/public`,
        {
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        }
      );

      const items = await foldersResponse.json();
      const folders = items.filter(item => item.type === 'dir').map(item => item.name);

      let totalImages = 0;
      let totalSize = 0;
      let totalTagged = 0;
      let folderStats = {};
      let recentUploads = [];
      let tagCounts = {};

      for (const folder of folders) {
        try {
          // Get files in folder
          const filesResponse = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/public/${folder}`,
            {
              headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
              },
            }
          );

          if (!filesResponse.ok) continue;
          const files = await filesResponse.json();

          // Get metadata
          let metadata = {};
          try {
            const metaResponse = await fetch(
              `https://api.github.com/repos/${owner}/${repo}/contents/public/${folder}/metadata.json`,
              {
                headers: {
                  'Authorization': `token ${token}`,
                  'Accept': 'application/vnd.github.v3+json',
                },
              }
            );
            if (metaResponse.ok) {
              const metaData = await metaResponse.json();
              metadata = JSON.parse(Buffer.from(metaData.content, 'base64').toString('utf8'));
            }
          } catch (e) {}

          const images = files.filter(f => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(f.name));
          
          folderStats[folder] = {
            count: images.length,
            size: images.reduce((sum, f) => sum + (f.size || 0), 0)
          };

          totalImages += images.length;
          totalSize += folderStats[folder].size;

          images.forEach(img => {
            const meta = metadata[img.name];
            if (meta) {
              if (meta.tags) {
                totalTagged++;
                meta.tags.split(',').forEach(tag => {
                  const t = tag.trim().toLowerCase();
                  if (t) tagCounts[t] = (tagCounts[t] || 0) + 1;
                });
              }
              if (meta.uploadedAt) {
                recentUploads.push({
                  name: img.name,
                  folder,
                  url: `https://images.newbold.cloud/${folder}/${img.name}`,
                  uploadedAt: meta.uploadedAt
                });
              }
            }
          });

        } catch (e) {
          console.error(`Error processing ${folder}:`, e);
        }
      }

      // Sort recent uploads
      recentUploads.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
      recentUploads = recentUploads.slice(0, 10);

      // Top tags
      const topTags = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([tag, count]) => ({ tag, count }));

      return res.status(200).json({
        summary: {
          totalImages,
          totalSize,
          totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
          totalTagged,
          percentTagged: totalImages > 0 ? Math.round((totalTagged / totalImages) * 100) : 0,
          folderCount: folders.length
        },
        folders: folderStats,
        recentUploads,
        topTags,
        generatedAt: new Date().toISOString()
      });

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // POST - Track image access (for future analytics)
  if (req.method === 'POST') {
    // This would store access logs in a database like Supabase
    // For now, just acknowledge
    return res.status(200).json({ tracked: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
