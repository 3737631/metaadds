export interface StoreCandidate {
  id: string;
  name: string;
  url: string;
  domain: string;
  category: string;
  country: string;
  similarity: number;
  competitorScore?: number;
  shopify: boolean;
  platform?: string;
  verified: boolean;
  title: string;
  snippet: string;
}

export interface BrandAnalysis {
  logoUrl: string | null;
  colors: string[];
  fontFamily: string | null;
  style: string;
}

export interface SectionAnalysis {
  type: string;
  heading: string | null;
  notes: string;
}

export interface StoreAnalysis {
  url: string;
  domain: string;
  shopify: boolean;
  title: string | null;
  description: string | null;
  brand: BrandAnalysis;
  home: {
    hero: string | null;
    benefits: string[];
    socialProof: boolean;
    productCount: number | null;
    hasFaq: boolean;
    hasCta: boolean;
    sections: SectionAnalysis[];
  };
  product: {
    title: string | null;
    price: number | null;
    currency: string;
    offer: string | null;
    variantsCount: number | null;
    description: string | null;
    hasReviews: boolean;
    guarantee: string | null;
    cta: string | null;
  };
  conversion: {
    offerClarity: number;
    socialProofScore: number;
    trustScore: number;
    ctaClarity: number;
    structureScore: number;
    urgency: boolean;
    valueProp: string | null;
    strengths: string[];
    weaknesses: string[];
  };
  rawExcerpt: string;
}

export interface StoreTheme {
  name: string;
  brandName: string;
  tagline: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  fontFamily: string;
  header: {
    logoText: string;
    menu: string[];
  };
  hero: {
    headline: string;
    subheadline: string;
    ctaLabel: string;
    ctaHref: string;
    showImage: boolean;
  };
  homeSections: {
    type: string;
    heading: string;
    text: string;
    ctaLabel?: string;
    ctaHref?: string;
    imageUrl?: string;
    items?: { title: string; text: string }[];
  }[];
  product: {
    title: string;
    price: number;
    compareAtPrice: number | null;
    description: string;
    benefits: string[];
    ctaLabel: string;
    badge: string | null;
    currency: string;
  };
  footer: {
    about: string;
    links: { text: string; href: string }[];
    newsletter: boolean;
  };
}
