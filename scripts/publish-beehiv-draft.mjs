import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Load .env variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(rootDir, '.env') });

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    file: path.join(rootDir, 'drafts', 'fall_festival_scene_nc.md'),
    dryRun: false,
    publish: false,
    postId: null,
    listPosts: false,
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--file' && args[i + 1]) {
      options.file = path.resolve(rootDir, args[i + 1]);
      i++;
    } else if (args[i] === '--dry-run') {
      options.dryRun = true;
    } else if (args[i] === '--publish') {
      options.publish = true;
    } else if ((args[i] === '--post-id' || args[i] === '--update') && args[i + 1]) {
      options.postId = args[i + 1];
      i++;
    } else if (args[i] === '--list-posts') {
      options.listPosts = true;
    }
  }

  return options;
}

/**
 * Lightweight Markdown to HTML converter for newsletter body_content
 */
function markdownToHtml(markdown) {
  let html = markdown;

  // Remove H1 title and initial blockquote subtitle if we extract them separately
  const lines = html.split('\n');
  let bodyLines = [];
  let skippedTitle = false;
  let skippedSubtitle = false;

  for (let line of lines) {
    if (!skippedTitle && line.trim().startsWith('# ')) {
      skippedTitle = true;
      continue;
    }
    if (skippedTitle && !skippedSubtitle && line.trim().startsWith('> ')) {
      skippedSubtitle = true;
      continue;
    }
    bodyLines.push(line);
  }

  html = bodyLines.join('\n');

  // Convert headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');

  // Convert blockquotes
  html = html.replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>');

  // Convert bold and italic
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Convert horizontal rules
  html = html.replace(/^---$/gim, '<hr />');
  html = html.replace(/^\*\*\*$/gim, '<hr />');

  // Convert unordered lists
  html = html.replace(/^\* (.*$)/gim, '<li>$1</li>');
  html = html.replace(/^- (.*$)/gim, '<li>$1</li>');

  // Wrap continuous <li> tags in <ul>
  html = html.replace(/(<li>.*<\/li>)/gs, (match) => {
    return `<ul>${match}</ul>`;
  });

  // Convert line breaks to paragraphs
  const paragraphs = html
    .split(/\n\s*\n/)
    .map((p) => {
      p = p.trim();
      if (!p) return '';
      if (p.startsWith('<h') || p.startsWith('<ul>') || p.startsWith('<blockquote') || p.startsWith('<hr')) {
        return p;
      }
      return `<p>${p}</p>`;
    })
    .filter(Boolean);

  return paragraphs.join('\n');
}

function extractMetadata(markdownContent) {
  const lines = markdownContent.split('\n');
  let title = 'EZ Vibes NC Fall Festival Guide';
  let subtitle = '';

  for (let line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('# ')) {
      title = trimmed.replace(/^#\s*/, '').replace(/^[^\w\s]+/, '').trim();
    } else if (trimmed.startsWith('> ') && !subtitle) {
      subtitle = trimmed.replace(/^>\s*/, '').replace(/\*/g, '').trim();
    }
  }

  return { title, subtitle };
}

async function getPublicationId(apiKey) {
  let pubId = process.env.BEEHIIV_PUBLICATION_ID;
  if (pubId) return pubId;

  console.log('🔍 Auto-fetching Publication ID from Beehiiv...');
  try {
    const res = await fetch('https://api.beehiiv.com/v2/publications', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    const data = await res.json();
    if (res.ok && data?.data?.length > 0) {
      pubId = data.data[0].id;
      console.log(`✅ Auto-discovered Publication ID: ${pubId}`);
      return pubId;
    }
  } catch (err) {
    console.error('⚠️ Failed to auto-fetch publication ID:', err.message);
  }
  return null;
}

async function run() {
  const options = parseArgs();
  console.log('🐝 [Beehiiv API Client] Starting process...');

  const apiKey = process.env.BEEHIIV_API_KEY;
  if (!apiKey) {
    console.log('\n❌ BEEHIIV_API_KEY is not set in nido-api/.env');
    console.log('   Please add BEEHIIV_API_KEY=your_key to nido-api/.env');
    process.exit(1);
  }

  const publicationId = await getPublicationId(apiKey);
  if (!publicationId) {
    console.error('❌ Error: Could not determine BEEHIIV_PUBLICATION_ID. Please set BEEHIIV_PUBLICATION_ID in .env');
    process.exit(1);
  }

  // Handle --list-posts mode
  if (options.listPosts) {
    console.log(`\n📋 Fetching posts from Beehiiv (Publication ID: ${publicationId})...`);
    try {
      const res = await fetch(`https://api.beehiiv.com/v2/publications/${publicationId}/posts`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
      const data = await res.json();
      if (res.ok) {
        console.log('\n--- Existing Beehiiv Posts ---');
        (data.data || []).forEach(post => {
          console.log(`🆔 ID: ${post.id} | 📌 Status: ${post.status} | 📝 Title: ${post.title}`);
        });
      } else {
        console.error('❌ Failed to fetch posts:', JSON.stringify(data, null, 2));
      }
    } catch (err) {
      console.error('❌ Error fetching posts:', err);
    }
    return;
  }

  console.log(`📄 Target File: ${options.file}`);
  if (!fs.existsSync(options.file)) {
    console.error(`❌ Error: File not found at ${options.file}`);
    process.exit(1);
  }

  const fileContent = fs.readFileSync(options.file, 'utf-8');
  const { title, subtitle } = extractMetadata(fileContent);
  const htmlBody = markdownToHtml(fileContent);

  const payload = {
    title: title,
    subtitle: subtitle,
    body_content: htmlBody,
    status: options.publish ? 'confirmed' : 'draft',
  };

  console.log('\n--- Extracted Post Metadata ---');
  console.log(`📌 Title: ${payload.title}`);
  console.log(`📝 Subtitle: ${payload.subtitle}`);
  console.log(`📊 Body Length: ${payload.body_content.length} characters`);
  console.log(`🏷️  Status: ${payload.status}`);

  if (options.dryRun) {
    console.log('\n⚠️  [DRY RUN MODE]');
    console.log(JSON.stringify(payload, null, 2).slice(0, 800) + '...\n');
    console.log('✅ Payload validation passed successfully.');
    return;
  }

  const isUpdate = Boolean(options.postId);
  const normalizedPostId = isUpdate ? options.postId : null;
  const endpoint = isUpdate
    ? `https://api.beehiiv.com/v2/publications/${publicationId}/posts/${normalizedPostId}`
    : `https://api.beehiiv.com/v2/publications/${publicationId}/posts`;
  const method = isUpdate ? 'PUT' : 'POST';



  console.log(`\n🚀 ${isUpdate ? 'Updating existing post' : 'Creating new post'} on Beehiiv API v2...`);
  console.log(`📍 Endpoint: ${method} ${endpoint}`);

  try {
    const response = await fetch(endpoint, {
      method: method,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseData = await response.json();

    if (response.ok || response.status === 200 || response.status === 201 || response.status === 202) {
      console.log(`🎉 Post ${isUpdate ? 'updated' : 'created'} successfully on Beehiiv!`);
      console.log(`🆔 Post ID: ${responseData?.data?.id || options.postId || 'OK'}`);
      console.log(`🔗 Web URL: ${responseData?.data?.web_url || 'Check Beehiiv Dashboard'}`);
    } else {
      console.error(`❌ Beehiiv API Error (${response.status}):`, JSON.stringify(responseData, null, 2));
    }
  } catch (error) {
    console.error('❌ Network failure connecting to Beehiiv API:', error);
  }
}

run();
