import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getBlogPost, blogPosts, formatDate } from '@/lib/blog';
import { Clock, Calendar, ArrowLeft } from 'lucide-react';
import { CommentsSection } from '@/components/blog/CommentsSection';

interface Props {
  params: { slug: string };
}

export async function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = getBlogPost(params.slug);
  if (!post) return {};

  return {
    title: post.title,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      publishedTime: post.date,
    },
  };
}

export default function BlogPostPage({ params }: Props) {
  const post = getBlogPost(params.slug);
  if (!post) notFound();

  return (
    <main className="min-h-screen bg-background text-foreground pt-24 pb-20">
      <div className="mx-auto max-w-2xl px-4 sm:px-6">
        {/* Geri Butonu */}
        <Link
          href="/blog"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-[rgba(255,255,255,0.4)] hover:text-amber-400 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Tüm Yazılar
        </Link>

        {/* Başlık */}
        <header className="mb-8">
          <h1 className="text-2xl font-bold leading-snug tracking-tight text-foreground sm:text-3xl">
            {post.title}
          </h1>
          <p className="mt-3 text-base text-[rgba(255,255,255,0.45)] leading-relaxed">
            {post.description}
          </p>
          <div className="mt-4 flex items-center gap-4 text-xs text-[rgba(255,255,255,0.3)]">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(post.date)}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {post.readTime} dk okuma
            </span>
          </div>
        </header>

        <div className="border-t border-[rgba(255,255,255,0.06)] pt-8" />

        {/* İçerik */}
        <article
          className="prose-blog"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        {/* CTA */}
        <div className="mt-12 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6 text-center">
          <p className="text-base font-semibold text-foreground">
            Kârlılığınızı otomatik hesaplayın
          </p>
          <p className="mt-1.5 text-sm text-[rgba(255,255,255,0.45)]">
            Kârnet ile her ürünün net kârını, iade etkisini ve başabaş noktasını
            saniyeler içinde görün.
          </p>
          <Link
            href="/auth"
            className="mt-4 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white transition-all hover:-translate-y-[1px] hover:shadow-lg hover:shadow-amber-500/30"
            style={{ background: 'linear-gradient(135deg, #D97706, #92400E)' }}
          >
            Ücretsiz Dene
            <ArrowLeft className="h-4 w-4 rotate-180" />
          </Link>
        </div>

        <CommentsSection slug={params.slug} />
      </div>
    </main>
  );
}
