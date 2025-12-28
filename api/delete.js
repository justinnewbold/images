export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { folder, filename } = req.body;
    
    if (!folder || !filename) {
      return res.status(400).json({ error: 'Missing folder or filename' });
    }

    const token = process.env.GITHUB_TOKEN;
    const owner = 'justinnewbold';
    const repo = 'images';
    const path = `public/${folder}/${filename}`;

    // Get file SHA first
    const getResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    );

    if (!getResponse.ok) {
      return res.status(404).json({ error: 'File not found' });
    }

    const fileData = await getResponse.json();

    // Delete the file
    const deleteResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `Delete ${filename}`,
          sha: fileData.sha,
        }),
      }
    );

    if (!deleteResponse.ok) {
      const error = await deleteResponse.json();
      return res.status(deleteResponse.status).json({ error: error.message });
    }

    // Also remove from metadata if exists
    await removeFromMetadata(token, owner, repo, folder, filename);

    return res.status(200).json({ success: true, deleted: filename });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

async function removeFromMetadata(token, owner, repo, folder, filename) {
  try {
    const metadataPath = `public/${folder}/metadata.json`;
    
    const getResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${metadataPath}`,
      {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    );

    if (!getResponse.ok) return;

    const data = await getResponse.json();
    const metadata = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
    
    if (metadata[filename]) {
      delete metadata[filename];
      
      const content = Buffer.from(JSON.stringify(metadata, null, 2)).toString('base64');
      
      await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${metadataPath}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: `Remove metadata for ${filename}`,
            content,
            sha: data.sha,
          }),
        }
      );
    }
  } catch (e) {
    console.error('Failed to remove metadata:', e);
  }
}
