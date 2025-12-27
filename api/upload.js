export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { filename, content, folder } = req.body;

    if (!filename || !content || !folder) {
      return res.status(400).json({ error: 'Missing required fields: filename, content, folder' });
    }

    const token = process.env.GITHUB_TOKEN;
    const owner = 'justinnewbold';
    const repo = 'images';
    const path = `public/${folder}/${filename}`;

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
          message: `Upload ${filename}`,
          content: content,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.message || 'Upload failed' });
    }

    const imageUrl = `https://images.newbold.cloud/${folder}/${filename}`;
    
    return res.status(200).json({ 
      success: true, 
      url: imageUrl,
      commit: data.commit?.html_url 
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
