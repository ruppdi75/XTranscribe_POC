
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

interface ConfluencePageRequestBody {
  title: string;
  content: string; // Markdown content from frontend
  spaceKey?: string;
}

// Basic Markdown to Confluence Storage Format (XHTML)
function convertMarkdownToConfluenceStorageFormat(markdown: string): string {
  if (!markdown) return '';

  let html = markdown;

  // ## Headings to <h2>
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  // # Headings to <h1>
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Bold: **text** to <strong>text</strong>
  html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
  // Italic: *text* or _text_ to <em>text</em>
  html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>');
  html = html.replace(/_(.*?)_/gim, '<em>$1</em>');
  
  // Horizontal rule --- to <hr />
  html = html.replace(/^---$/gim, '<hr />');

  // Paragraphs:
  // Split by block elements (headings, hr) and process each block
  const blocks = html.split(/(?=<h2>|<hr \/>)/gim);
  html = blocks.map(block => {
    if (block.startsWith('<h2>') || block.startsWith('<hr />')) {
      return block;
    }
    // For non-heading/hr blocks, trim and wrap in <p>, convert single newlines to <br />
    const trimmedBlock = block.trim();
    if (trimmedBlock) {
      return `<p>${trimmedBlock.replace(/\n(?!$)/g, '<br />')}</p>`; // Avoid <br /> for trailing newline
    }
    return '';
  }).join('');
  
  // Remove empty paragraphs that might result from multiple newlines
  html = html.replace(/<p>\s*<\/p>/g, '');

  // If after all replacements, the content is not wrapped in a block-level tag, wrap it in <p>
  // This is a fallback for simple text not matching other rules.
  if (html.length > 0 && !html.match(/^<(h[1-6]|p|hr|ul|ol|li|div|table)/gim)) {
    html = `<p>${html}</p>`;
  }

  return html;
}


export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as ConfluencePageRequestBody;
    const { title, content } = body;
    let { spaceKey } = body;

    const confluenceUrl = process.env.CONFLUENCE_URL;
    const confluenceUsername = process.env.CONFLUENCE_USERNAME;
    const confluenceToken = process.env.CONFLUENCE_TOKEN;
    const defaultSpaceKey = process.env.CONFLUENCE_SPACE_KEY;

    if (!confluenceUrl || !confluenceUsername || !confluenceToken) {
      return NextResponse.json({ success: false, message: "Confluence API credentials are not configured on the server." }, { status: 500 });
    }
    if (!defaultSpaceKey && !spaceKey) {
        return NextResponse.json({ success: false, message: "Confluence Space Key is not configured." }, { status: 500 });
    }

    spaceKey = spaceKey || defaultSpaceKey; 

    if (!title || !content) {
      return NextResponse.json({ success: false, message: "Title and content are required." }, { status: 400 });
    }
    if (!spaceKey) {
      return NextResponse.json({ success: false, message: "Space Key is required for Confluence page creation." }, { status: 400 });
    }

    const auth = Buffer.from(`${confluenceUsername}:${confluenceToken}`).toString('base64');
    const confluenceStorageContent = convertMarkdownToConfluenceStorageFormat(content);

    if (!confluenceStorageContent.trim()) {
      return NextResponse.json({ success: false, message: "Converted content for Confluence is empty. Cannot create page." }, { status: 400 });
    }
    
    const apiRequestBody = {
      type: 'page',
      title: title,
      space: { key: spaceKey },
      body: {
        storage: {
          value: confluenceStorageContent,
          representation: 'storage',
        },
      },
    };

    const apiTargetUrl = `${confluenceUrl.replace(/\/$/, '')}/wiki/rest/api/content`;
    console.log(`Attempting to POST to Confluence: ${apiTargetUrl} with title "${title}" in space "${spaceKey}"`);

    const response = await fetch(apiTargetUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(apiRequestBody),
    });

    let responseData: any;
    const responseContentType = response.headers.get("content-type");

    if (responseContentType && responseContentType.includes("application/json")) {
      try {
        responseData = await response.json();
      } catch (e) {
        console.error('Confluence API response: Failed to parse JSON response. Status:', response.status, 'Status Text:', response.statusText, e);
        const responseText = await response.text().catch(() => "Could not get response text.");
        console.error('Confluence API non-JSON response text:', responseText.substring(0, 500));
        return NextResponse.json({
          success: false,
          message: `Confluence API returned an unparseable JSON response (Status: ${response.status}). Check server logs. Preview: ${responseText.substring(0, 200)}...`
        }, { status: response.status || 500 });
      }
    } else {
      const responseText = await response.text().catch(() => "Could not retrieve response text.");
      console.error('Confluence API returned a non-JSON response. Status:', response.status, 'Status Text:', response.statusText);
      console.error('Confluence API non-JSON response text:', responseText.substring(0, 1000));
      return NextResponse.json({
        success: false,
        message: `Confluence API returned a non-JSON response (Status: ${response.status}). This could be an HTML error page from Confluence. Check server logs. Preview: ${responseText.substring(0,200)}...`
      }, { status: response.status || 500 });
    }

    if (!response.ok) {
      console.error('Confluence API Error Response (parsed JSON):', responseData);
      let specificErrorMessage = '';
      if (responseData && responseData.message) {
        specificErrorMessage = responseData.message;
      } else if (responseData?.data?.message) { // Check nested message for some error structures
        specificErrorMessage = responseData.data.message;
      } else if (responseData && responseData.errorMessages && Array.isArray(responseData.errorMessages) && responseData.errorMessages.length > 0) {
        specificErrorMessage = responseData.errorMessages.join(', ');
      } else if (responseData && responseData.data && responseData.data.errors && Array.isArray(responseData.data.errors) && responseData.data.errors.length > 0) {
        specificErrorMessage = responseData.data.errors.map((err: any) => err.message).join(', ');
      }
      
      const finalMessage = specificErrorMessage || 
                           `Failed to create page (Status: ${response.status}). Response: ${JSON.stringify(responseData || 'No response body').substring(0, 250)}`;
      
      return NextResponse.json({ success: false, message: finalMessage }, { status: response.status });
    }
    
    let pageUrl = '';
    const links = responseData._links;

    if (links && links.webui) {
        if (links.base) {
            // Ideal: API provides base and relative webui path
            try {
                pageUrl = new URL(links.webui, links.base).toString();
            } catch (e) {
                console.warn(`Failed to construct URL from API's _links.base (${links.base}) and _links.webui (${links.webui}). Error: ${e}. Falling back.`);
                // Fallback to using CONFLUENCE_URL from .env with webui, ensuring webui starts with a slash if relative.
                const webuiPath = links.webui.startsWith('/') ? links.webui : `/${links.webui}`;
                pageUrl = confluenceUrl.replace(/\/$/, '') + webuiPath;
            }
        } else {
            // API provided webui but no base, use CONFLUENCE_URL from .env as base
            const webuiPath = links.webui.startsWith('/') ? links.webui : `/${links.webui}`;
            pageUrl = confluenceUrl.replace(/\/$/, '') + webuiPath;
        }
    }

    // If pageUrl couldn't be formed from _links, try using pageId as a strong fallback
    if (!pageUrl && responseData.id) {
        console.log(`Constructing page URL using pageId as _links.webui was insufficient or problematic.`);
        pageUrl = `${confluenceUrl.replace(/\/$/, '')}/wiki/pages/viewpage.action?pageId=${responseData.id}`;
    }

    // Ultimate fallback if no usable link information is found
    if (!pageUrl) {
        pageUrl = `${confluenceUrl.replace(/\/$/, '')}/wiki/display/${spaceKey}`;
        console.warn("Confluence API response did not provide sufficient data (_links.webui or id) to construct a direct page URL. Falling back to space URL.");
    }


    return NextResponse.json({
      success: true,
      message: `Successfully created Confluence page: "${responseData.title || title}"`,
      url: pageUrl,
    });

  } catch (error: any) {
    console.error('Error in /api/confluence/create-page route:', error);
    return NextResponse.json({ success: false, message: error.message || "An unexpected error occurred on the server." }, { status: 500 });
  }
}
