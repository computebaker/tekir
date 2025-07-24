import { NextRequest, NextResponse } from "next/server";

// Convex proxy to hide production deployment URL
// Note: WebSocket upgrades are handled by Next.js rewrites in next.config.js
export async function GET(request: NextRequest) {
  return handleConvexProxy(request);
}

export async function POST(request: NextRequest) {
  return handleConvexProxy(request);
}

export async function PUT(request: NextRequest) {
  return handleConvexProxy(request);
}

export async function DELETE(request: NextRequest) {
  return handleConvexProxy(request);
}

export async function PATCH(request: NextRequest) {
  return handleConvexProxy(request);
}

async function handleConvexProxy(request: NextRequest) {
  // Get the real Convex URL from environment
  const convexUrl = process.env.CONVEX_URL || process.env.NEXT_PUBLIC_CONVEX_URL;
  
  if (!convexUrl) {
    return NextResponse.json({ error: "Convex URL not configured" }, { status: 500 });
  }

  try {
    // Extract the path after /api/convex/
    const url = new URL(request.url);
    const convexPath = url.pathname.replace('/api/convex', '');
    const searchParams = url.searchParams.toString();
    
    // Construct the target URL
    const targetUrl = `${convexUrl}${convexPath}${searchParams ? `?${searchParams}` : ''}`;
    
    console.log(`🔄 Proxying request: ${url.pathname} → ${targetUrl}`);
    
    // Forward the request to Convex
    const headers = new Headers(request.headers);
    
    // Remove problematic headers
    headers.delete('host');
    headers.delete('x-forwarded-host');
    headers.delete('x-forwarded-proto');
    headers.delete('x-forwarded-for');

    const body = request.method !== 'GET' && request.method !== 'HEAD' 
      ? await request.arrayBuffer() 
      : undefined;

    const response = await fetch(targetUrl, {
      method: request.method,
      headers: headers,
      body: body,
    });

    // Create response with Convex data
    const responseHeaders = new Headers(response.headers);
    
    // Add CORS headers
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

    // Get response body
    const responseBody = await response.arrayBuffer();
    
    console.log(`✅ Proxy response: ${response.status} ${response.statusText}`);
    
    return new Response(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('❌ Convex proxy error:', error);
    return NextResponse.json(
      { error: "Failed to proxy request to Convex", details: error instanceof Error ? error.message : String(error) }, 
      { status: 500 }
    );
  }
}

// Handle preflight requests
export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Max-Age': '86400',
    },
  });
}
