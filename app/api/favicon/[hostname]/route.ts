import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ hostname: string }> }
) {
  const { hostname } = await params;

  // Validate hostname to prevent abuse
  if (!hostname || hostname.length > 253) {
    return NextResponse.json({ error: 'Invalid hostname' }, { status: 400 });
  }

  // Basic hostname validation (allow alphanumeric, dots, hyphens)
  const hostnameRegex = /^[a-zA-Z0-9.-]+$/;
  if (!hostnameRegex.test(hostname)) {
    return NextResponse.json({ error: 'Invalid hostname format' }, { status: 400 });
  }

  try {
    // Proxy the favicon request to DuckDuckGo's service
    const faviconUrl = `https://icons.duckduckgo.com/ip3/${hostname}.ico`;

    const response = await fetch(faviconUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Tekir/1.0)',
        'Accept': 'image/*',
      },
    });

    if (!response.ok) {
      // If DuckDuckGo doesn't have the favicon, return a 404
      return new NextResponse(null, { status: 404 });
    }

    // Get the favicon data
    const faviconData = await response.arrayBuffer();

    // Return the favicon with appropriate headers
    return new NextResponse(faviconData, {
      status: 200,
      headers: {
        'Content-Type': 'image/x-icon',
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
        'Content-Length': faviconData.byteLength.toString(),
      },
    });

  } catch (error) {
    console.error('Favicon proxy error:', error);
    return NextResponse.json({ error: 'Failed to fetch favicon' }, { status: 500 });
  }
}
