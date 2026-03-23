import { blogPosts } from '@/lib/blog'

export async function GET() {
  const blogs = blogPosts.map((post) => `
    <url>
      <loc>https://www.xn--krnet-3qa.com/blog/${post.slug}</loc>
      <priority>0.6</priority>
    </url>`).join('')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.xn--krnet-3qa.com</loc><priority>1</priority></url>
  <url><loc>https://www.xn--krnet-3qa.com/pricing</loc><priority>0.9</priority></url>
  <url><loc>https://www.xn--krnet-3qa.com/demo</loc><priority>0.8</priority></url>
  <url><loc>https://www.xn--krnet-3qa.com/blog</loc><priority>0.8</priority></url>
  <url><loc>https://www.xn--krnet-3qa.com/hakkimizda</loc><priority>0.7</priority></url>
  <url><loc>https://www.xn--krnet-3qa.com/iletisim</loc><priority>0.7</priority></url>
  ${blogs}
</urlset>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
    },
  })
}
