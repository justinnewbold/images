export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { folder } = req.query;
  
  if (!folder) {
    return res.status(400).json({ error: 'Folder parameter required' });
  }

  try {
    const token = process.env.GITHUB_TOKEN;
    const owner = 'justinnewbold';
    const repo = 'images';

    // Get list of files in folder
    const listResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/public/${folder}`,
      {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    );

    if (!listResponse.ok) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    const files = await listResponse.json();
    
    // Filter for media files only
    const mediaFiles = files.filter(f => 
      /\.(jpg|jpeg|png|gif|webp|svg|pdf|mp4|mov|webm|mp3|wav)$/i.test(f.name)
    );

    if (mediaFiles.length === 0) {
      return res.status(404).json({ error: 'No files found in folder' });
    }

    // Return download links
    const downloadLinks = mediaFiles.map(f => ({
      name: f.name,
      downloadUrl: f.download_url,
      viewUrl: `https://images.newbold.cloud/${folder}/${f.name}`,
      size: f.size
    }));

    return res.status(200).json({
      folder,
      count: downloadLinks.length,
      files: downloadLinks
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
