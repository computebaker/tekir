import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Allow only the main page (i.e. the exact root URL):
      {
        userAgent: '*',
        allow: '/$',
        disallow: '/',
      }
    ]
  }
}