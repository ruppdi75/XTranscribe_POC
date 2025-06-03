
/**
 * Represents the structure for creating a page in Confluence.
 * This is sent from the frontend to our backend API route.
 */
export interface ConfluencePageCreateRequest {
    title: string;
    content: string; // Markdown content
    spaceKey?: string; // Optional space key, backend will use .env default if not provided
}

/**
 * Represents the response received from our backend API route 
 * after attempting to create a page in Confluence.
 */
export interface ConfluencePageCreateResponse {
    success: boolean;
    message: string;
    url?: string;
}

/**
 * Asynchronously creates a page in Confluence by calling our backend API route.
 * This function does NOT handle API tokens directly; that is the responsibility
 * of the backend API route /api/confluence/create-page.
 *
 * @param pageData An object containing the title and content (in Markdown) for the Confluence page.
 * @returns A promise that resolves to a ConfluencePageCreateResponse object from our backend.
 */
export async function createConfluencePage(pageData: ConfluencePageCreateRequest): Promise<ConfluencePageCreateResponse> {
    console.log("Sending request to backend for Confluence page creation:", pageData);

    try {
        const response = await fetch('/api/confluence/create-page', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // No Authorization header here; the backend handles authentication.
            },
            body: JSON.stringify(pageData),
        });

        // It's generally better to check response.ok before trying to parse JSON,
        // as a server error (500, etc.) might not return valid JSON.
        if (!response.ok) {
            let errorMessage = `Failed to create Confluence page. Server responded with status: ${response.status}`;
            try {
                // Try to get more specific error message from backend response
                const errorResult: Partial<ConfluencePageCreateResponse> = await response.json();
                errorMessage = errorResult.message || errorMessage;
            } catch (e) {
                // If parsing error.json fails, stick with the status code message
                console.warn("Could not parse error response JSON from backend for Confluence page creation.");
            }
            console.error('Error from backend creating Confluence page:', errorMessage);
            return {
                success: false,
                message: errorMessage,
            };
        }
        
        const result: ConfluencePageCreateResponse = await response.json();
        console.log("Backend response for Confluence page creation:", result);
        return result;

    } catch (error: any) {
        console.error('Network or unexpected error calling backend for Confluence page creation:', error);
        return {
            success: false,
            message: error.message || 'An unexpected network error occurred while trying to create the Confluence page.',
        };
    }
}
