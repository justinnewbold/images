export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { folder, filename, tags, description } = req.body;
    
    if (!folder || !filename) {
      return res.status(400).json({ error: 'Missing folder or filename' });
    }

    const token = process.env.GITHUB_TOKEN;
    const owner = 'justinnewbold';
    const repo = 'images';
    const metadataPath = `public/${folder}/metadata.json`;

    // Get existing metadata
    let metadata = {};
    let sha = null;

    try {
      const getResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${metadataPath}`,
        {
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        }
      );

      if (getResponse.ok) {
        const data = await getResponse.json();
        sha = data.sha;
        metadata = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
      }
    } catch (e) {
      // No existing metadata, that's fine
    }

    // Update metadata for this file
    metadata[filename] = {
      tags: tags || null,
      description: description || null,
      updatedAt: new Date().toISOString()
    };

    const content = Buffer.from(JSON.stringify(metadata, null, 2)).toString('base64');
    
    const putBody = {
      message: `Update metadata for ${filename}`,
      content,
    };
    
    if (sha) {
      putBody.sha = sha;
    }

    const putResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${metadataPath}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(putBody),
      }
    );

    if (!putResponse.ok) {
      const error = await putResponse.json();
      return res.status(putResponse.status).json({ error: error.message });
    }

    return res.status(200).json({ 
      success: true, 
      filename,
      tags,
      description
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
