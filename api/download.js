import JSZip from 'jszip';

export const config = {
  api: {
    responseLimit: false,
  },
};

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

    // Create ZIP
    const zip = new JSZip();

    // Download and add each file to ZIP
    for (const file of mediaFiles) {
      try {
        const fileResponse = await fetch(file.download_url);
        if (fileResponse.ok) {
          const buffer = await fileResponse.arrayBuffer();
          zip.file(file.name, buffer);
        }
      } catch (e) {
        console.error(`Failed to add ${file.name}:`, e);
      }
    }

    // Generate ZIP buffer
    const zipBuffer = await zip.generateAsync({ 
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    // Send ZIP file
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${folder}-images.zip"`);
    res.setHeader('Content-Length', zipBuffer.length);
    
    return res.status(200).send(zipBuffer);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
