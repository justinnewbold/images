export default async function handler(req, res) {
  // Enable CORS for AI tools
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = process.env.GITHUB_TOKEN;
    const owner = 'justinnewbold';
    const repo = 'images';
    const folder = req.query.folder;
    
    const folders = folder ? [folder] : ['references', 'logos', 'textures', 'photos', 'assets'];
    const allImages = [];

    for (const f of folders) {
      try {
        // Get file list
        const filesResponse = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/contents/public/${f}`,
          {
            headers: {
              'Authorization': `token ${token}`,
              'Accept': 'application/vnd.github.v3+json',
            },
          }
        );

        if (!filesResponse.ok) continue;
        const files = await filesResponse.json();

        // Try to get metadata.json for this folder
        let metadata = {};
        try {
          const metaResponse = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/contents/public/${f}/metadata.json`,
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
        } catch (e) {
          // No metadata file, that's ok
        }

        // Filter for images and add metadata
        const images = files
          .filter(file => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.name))
          .map(file => ({
            name: file.name,
            folder: f,
            url: `https://images.newbold.cloud/${f}/${file.name}`,
            raw_url: file.download_url,
            size: file.size,
            tags: metadata[file.name]?.tags || null,
            description: metadata[file.name]?.description || null,
            uploadedAt: metadata[file.name]?.uploadedAt || null
          }));

        allImages.push(...images);
      } catch (e) {
        console.error(`Error fetching ${f}:`, e);
      }
    }

    // Return in a format friendly for AI tools
    return res.status(200).json({
      service: 'images.newbold.cloud',
      description: 'Image hosting service for AI generation',
      totalImages: allImages.length,
      folders: ['references', 'logos', 'textures', 'photos', 'assets'],
      images: allImages,
      api: {
        getImages: 'GET /api/images?folder=references',
        uploadImage: 'POST /api/upload { filename, content (base64), folder, tags?, description? }'
      }
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
