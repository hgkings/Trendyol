import { Metadata } from 'next';
import Link from 'next/link';
import { blogPosts, formatDate } from '@/lib/blog';
import { Clock, Calendar, ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Blog',
  description:
    "Trendyol ve e-ticaret satıcıları için kârlılık, maliyet yönetimi ve büyüme stratejileri hakkında rehber yazılar.",
};

export default function BlogPage() {
  return (
    <main className="min-h-screen bg-background text-foreground pt-24 pb-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        {/* Başlık */}
        <div className="mb-12 text-center">
          <p className="mb-3 text-sm font-medium uppercase tracking-widest text-amber-500">
            Blog
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            E-Ticaret Rehberleri
          </h1>
          <p className="mt-4 text-base text-muted-foreground max-w-xl mx-auto">
            Trendyol satıcıları için kârlılık, maliyet yönetimi ve büyüme
            stratejileri üzerine pratik yazılar.
          </p>
        </div>

        {/* Blog Kartları */}
        <div className="flex flex-col gap-5">
          {blogPosts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group block rounded-2xl border border-border/40 bg-card p-6 hover:bg-muted/20 hover:border-amber-500/20 transition-all duration-200"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold text-foreground group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors leading-snug">
                    {post.title}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed line-clamp-2">
                    {post.description}
                  </p>
                  <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground/60">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDate(post.date)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {post.readTime} dk okuma
                    </span>
                  </div>
                </div>
                <ArrowRight className="hidden sm:block h-5 w-5 text-muted-foreground/60 group-hover:text-amber-700 dark:group-hover:text-amber-400 group-hover:translate-x-1 transition-all shrink-0 mt-1" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
