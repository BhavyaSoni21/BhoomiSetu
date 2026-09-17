export interface GovtScheme {
  id: string;
  icon: string;
  acronym: string;
  nameKey: string;
  audienceKey: string;
  benefitKey: string;
  officialUrl: string;
  accentColor: {
    bg: string;
    text: string;
    border: string;
    badgeBg: string;
    badgeText: string;
  };
}
