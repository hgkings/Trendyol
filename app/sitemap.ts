import { MetadataRoute } from 'next'
import { blogPosts } from '@/lib/blog'

export default function sitemap(): MetadataRoute.Sitemap {
  const blogUrls = blogPosts.map((post) => ({
    url: `https://www.xn--krnet-3qa.com/blog/${post.slug}`,
    priority: 0.6,
  }))

  return [
    { url: 'https://www.xn--krnet-3qa.com', priority: 1 },
    { url: 'https://www.xn--krnet-3qa.com/pricing', priority: 0.9 },
    { url: 'https://www.xn--krnet-3qa.com/demo', priority: 0.8 },
    { url: 'https://www.xn--krnet-3qa.com/blog', priority: 0.8 },
    { url: 'https://www.xn--krnet-3qa.com/hakkimizda', priority: 0.7 },
    { url: 'https://www.xn--krnet-3qa.com/iletisim', priority: 0.7 },
    ...blogUrls,
  ]
}
