export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = process.env.GITHUB_TOKEN;
  const owner = 'justinnewbold';
  const repo = 'images';

  // GET - List all folders
  if (req.method === 'GET') {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/public`,
        {
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        }
      );

      if (!response.ok) {
        return res.status(response.status).json({ error: 'Failed to list folders' });
      }

      const items = await response.json();
      const folders = items
        .filter(item => item.type === 'dir')
        .map(item => item.name);

      return res.status(200).json({ folders });

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // POST - Create new folder
  if (req.method === 'POST') {
    try {
      const { name } = req.body;
      
      if (!name) {
        return res.status(400).json({ error: 'Folder name required' });
      }

      // Sanitize folder name
      const safeName = name.toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-');
      const path = `public/${safeName}/README.md`;
      
      // Create folder with a README
      const content = Buffer.from(`# ${name}\n\nCustom folder for images.`).toString('base64');
      
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: `Create folder: ${safeName}`,
            content,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        return res.status(response.status).json({ error: error.message });
      }

      return res.status(200).json({ success: true, folder: safeName });

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
