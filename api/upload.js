export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
};

// Supported file types
const SUPPORTED_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|svg|pdf|mp4|mov|webm|mp3|wav)$/i;
const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|svg)$/i;

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET request returns metadata for all files
  if (req.method === 'GET') {
    try {
      const token = process.env.GITHUB_TOKEN;
      const owner = 'justinnewbold';
      const repo = 'images';
      const folder = req.query.folder || 'references';
      
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/public/${folder}`,
        {
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        }
      );

      if (!response.ok) {
        return res.status(response.status).json({ error: 'Failed to fetch files' });
      }

      const files = await response.json();
      
      // Filter for supported file types and format response
      const items = files
        .filter(f => SUPPORTED_EXTENSIONS.test(f.name))
        .map(f => ({
          name: f.name,
          url: `https://images.newbold.cloud/${folder}/${f.name}`,
          raw_url: f.download_url,
          size: f.size,
          sha: f.sha,
          type: getFileType(f.name)
        }));

      return res.status(200).json({ 
        folder,
        count: items.length,
        files: items 
      });

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { filename, content, folder, tags, description } = req.body;

    if (!filename || !content || !folder) {
      return res.status(400).json({ error: 'Missing required fields: filename, content, folder' });
    }

    // Validate file type
    if (!SUPPORTED_EXTENSIONS.test(filename)) {
      return res.status(400).json({ 
        error: 'Unsupported file type. Allowed: jpg, png, gif, webp, svg, pdf, mp4, mov, webm, mp3, wav' 
      });
    }

    const token = process.env.GITHUB_TOKEN;
    const owner = 'justinnewbold';
    const repo = 'images';
    const path = `public/${folder}/${filename}`;

    // Upload the file
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
          message: `Upload ${filename}${tags ? ` [tags: ${tags}]` : ''}${description ? ` - ${description}` : ''}`,
          content: content,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.message || 'Upload failed' });
    }

    const fileUrl = `https://images.newbold.cloud/${folder}/${filename}`;
    
    // If tags or description provided, update the metadata JSON
    if (tags || description) {
      await updateMetadata(token, owner, repo, folder, filename, { tags, description, uploadedAt: new Date().toISOString() });
    }
    
    return res.status(200).json({ 
      success: true, 
      url: fileUrl,
      filename,
      folder,
      type: getFileType(filename),
      tags: tags || null,
      description: description || null,
      commit: data.commit?.html_url 
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

function getFileType(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
  if (['mp4', 'mov', 'webm'].includes(ext)) return 'video';
  if (['mp3', 'wav'].includes(ext)) return 'audio';
  if (ext === 'pdf') return 'pdf';
  return 'file';
}

async function updateMetadata(token, owner, repo, folder, filename, metadata) {
  const metadataPath = `public/${folder}/metadata.json`;
  
  try {
    // Try to get existing metadata
    const getResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${metadataPath}`,
      {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    );

    let existingMetadata = {};
    let sha = null;

    if (getResponse.ok) {
      const data = await getResponse.json();
      sha = data.sha;
      existingMetadata = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
    }

    // Add new file metadata
    existingMetadata[filename] = metadata;

    // Save updated metadata
    const content = Buffer.from(JSON.stringify(existingMetadata, null, 2)).toString('base64');
    
    const putBody = {
      message: `Update metadata for ${filename}`,
      content: content,
    };
    
    if (sha) {
      putBody.sha = sha;
    }

    await fetch(
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
  } catch (e) {
    console.error('Metadata update failed:', e);
  }
}
