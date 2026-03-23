import { MetadataRoute } from 'next'
import { blogPosts } from '@/lib/blog'

export default function sitemap(): MetadataRoute.Sitemap {
  const blogEntries: MetadataRoute.Sitemap = blogPosts.map((post) => ({
    url: `https://www.xn--krnet-3qa.com/blog/${post.slug}`,
    lastModified: new Date(post.date),
    priority: 0.7,
  }))

  return [
    { url: 'https://www.xn--krnet-3qa.com', priority: 1 },
    { url: 'https://www.xn--krnet-3qa.com/pricing', priority: 0.9 },
    { url: 'https://www.xn--krnet-3qa.com/demo', priority: 0.8 },
    { url: 'https://www.xn--krnet-3qa.com/blog', priority: 0.8 },
    { url: 'https://www.xn--krnet-3qa.com/hakkimizda', priority: 0.7 },
    { url: 'https://www.xn--krnet-3qa.com/iletisim', priority: 0.7 },
    ...blogEntries,
  ]
}
