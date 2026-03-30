
import {
    LayoutDashboard,
    PlusCircle,
    Package,
    Target,
    Landmark,
    Store,
    User,
    Settings,
    Crown,
    FileText,
    Upload,
    CreditCard,
    MessageSquare
} from 'lucide-react';
import type { PlanFeature } from '@/config/plans';

export interface NavItem {
    label: string;
    href: string;
    icon: typeof LayoutDashboard;
    requiredFeature?: PlanFeature;
    highlight?: boolean;
    action?: string;
}

export const NAV_ITEMS: NavItem[] = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Yeni Analiz', href: '/analysis/new', icon: PlusCircle },
    { label: 'Ürünler', href: '/products', icon: Package },
    { label: 'Başabaş', href: '/break-even', icon: Target, requiredFeature: 'breakEven' },
    { label: 'Nakit Planı', href: '/cash-plan', icon: Landmark, requiredFeature: 'cashflow' },
    { label: 'Pazaryeri', href: '/marketplace', icon: Store, requiredFeature: 'apiIntegration' },
];

export const BOTTOM_NAV_ITEMS: NavItem[] = [
    { label: 'Premium', href: '/pricing', icon: Crown, highlight: true },
    { label: 'Profil', href: '/account', icon: User },
    { label: 'Destek', href: '/support', icon: MessageSquare },
    { label: 'Ayarlar', href: '/settings', icon: Settings },
];

export const QUICK_ACTIONS: NavItem[] = [
    { label: 'PDF Rapor', href: '/dashboard', icon: FileText, action: 'pdf' },
    { label: 'CSV İçe Aktar', href: '/products', icon: Upload },
    { label: 'Fiyatlandırma', href: '/pricing', icon: CreditCard },
];
