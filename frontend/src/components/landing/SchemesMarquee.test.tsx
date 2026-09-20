import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../test/utils';
import { SchemesMarquee } from './SchemesMarquee';
import { GOVT_SCHEMES } from '../../data/govtSchemes';
import { LanguageProvider } from '../../context/LanguageContext';

describe('SchemesMarquee Component', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  const renderWithLanguage = (ui: React.ReactElement, initialLang?: string) => {
    if (initialLang) {
      localStorage.setItem('bhoomisetu_lang', initialLang);
    }
    return renderWithProviders(<LanguageProvider>{ui}</LanguageProvider>);
  };

  it('renders section heading and eyebrow badge in English', () => {
    renderWithLanguage(<SchemesMarquee schemes={GOVT_SCHEMES} />, 'en');
    expect(screen.getByText('Government Schemes Linked to Your Land')).toBeInTheDocument();
    expect(screen.getByText('Direct Farmer Benefits & Entitlements')).toBeInTheDocument();
  });

  it('renders section heading in Hindi (hi)', () => {
    renderWithLanguage(<SchemesMarquee schemes={GOVT_SCHEMES} />, 'hi');
    expect(screen.getByText('आपकी भूमि से जुड़ी सरकारी योजनाएं')).toBeInTheDocument();
    expect(screen.getByText('प्रत्यक्ष किसान लाभ एवं अधिकार')).toBeInTheDocument();
  });

  it('renders section heading in Gujarati (gu)', () => {
    renderWithLanguage(<SchemesMarquee schemes={GOVT_SCHEMES} />, 'gu');
    expect(screen.getByText('તમારી જમીન સાથે જોડાયેલ સરકારી યોજનાઓ')).toBeInTheDocument();
    expect(screen.getByText('પ્રત્યક્ષ ખેડૂત લાભો અને અધિકારો')).toBeInTheDocument();
  });

  it('renders section heading in Marathi (mr)', () => {
    renderWithLanguage(<SchemesMarquee schemes={GOVT_SCHEMES} />, 'mr');
    expect(screen.getByText('तुमच्या जमिनीशी संलग्न शासकीय योजना')).toBeInTheDocument();
    expect(screen.getByText('थेट शेतकरी लाभ व शासकीय योजना')).toBeInTheDocument();
  });

  it('renders section heading in Bengali (bn)', () => {
    renderWithLanguage(<SchemesMarquee schemes={GOVT_SCHEMES} />, 'bn');
    expect(screen.getByText('আপনার জমির সাথে সংযুক্ত সরকারি প্রকল্প')).toBeInTheDocument();
  });

  it('renders section heading in Kannada (kn)', () => {
    renderWithLanguage(<SchemesMarquee schemes={GOVT_SCHEMES} />, 'kn');
    expect(screen.getByText('ನಿಮ್ಮ ಭೂಮಿಗೆ ಸಂಬಂಧಿಸಿದ ಸರ್ಕಾರಿ ಯೋಜನೆಗಳು')).toBeInTheDocument();
  });

  it('renders section heading in Malayalam (ml)', () => {
    renderWithLanguage(<SchemesMarquee schemes={GOVT_SCHEMES} />, 'ml');
    expect(screen.getByText('നിങ്ങളുടെ ഭൂമിയുമായി ബന്ധിപ്പിച്ച സർക്കാർ പദ്ധതികൾ')).toBeInTheDocument();
  });

  it('renders section heading in Odia (or)', () => {
    renderWithLanguage(<SchemesMarquee schemes={GOVT_SCHEMES} />, 'or');
    expect(screen.getByText('ଆପଣଙ୍କ ଜମି ସହ ଜଡିତ ସରକାରୀ ଯୋଜନା')).toBeInTheDocument();
  });

  it('renders section heading in Punjabi (pa)', () => {
    renderWithLanguage(<SchemesMarquee schemes={GOVT_SCHEMES} />, 'pa');
    expect(screen.getByText('ਤੁਹਾਡੀ ਜ਼ਮੀਨ ਨਾਲ ਜੁੜੀਆਂ ਸਰਕਾਰੀ ਯੋਜਨਾਵਾਂ')).toBeInTheDocument();
  });

  it('renders section heading in Tamil (ta)', () => {
    renderWithLanguage(<SchemesMarquee schemes={GOVT_SCHEMES} />, 'ta');
    expect(screen.getByText('உங்கள் நிலத்துடன் இணைக்கப்பட்ட அரசு திட்டங்கள்')).toBeInTheDocument();
  });

  it('renders section heading in Telugu (te)', () => {
    renderWithLanguage(<SchemesMarquee schemes={GOVT_SCHEMES} />, 'te');
    expect(screen.getByText('మీ భూమితో అనుసంధానించబడిన ప్రభుత్వ పథకాలు')).toBeInTheDocument();
  });

  it('renders all six scheme cards with their acronyms', () => {
    renderWithLanguage(<SchemesMarquee schemes={GOVT_SCHEMES} />, 'en');
    
    // Check all 6 acronyms (each rendered in the marquee track)
    expect(screen.getAllByText('PM-KISAN').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('ULPIN').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('KCC').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Soil Health').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('PMFBY').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('PM-KUSUM').length).toBeGreaterThanOrEqual(1);
  });

  it('renders official portal links with target=_blank and rel=noopener', () => {
    renderWithLanguage(<SchemesMarquee schemes={GOVT_SCHEMES} />, 'en');
    
    const links = screen.getAllByRole('link');
    const pmKisanLink = links.find((l) => l.getAttribute('href') === 'https://pmkisan.gov.in');
    expect(pmKisanLink).toBeDefined();
    expect(pmKisanLink).toHaveAttribute('target', '_blank');
    expect(pmKisanLink).toHaveAttribute('rel', 'noopener noreferrer');

    const ulpinLink = links.find((l) => l.getAttribute('href') === 'https://dolr.gov.in/en/ulpin-bhu-aadhaar');
    expect(ulpinLink).toBeDefined();
  });

  it('allows manual pausing and manual arrow scrolling', () => {
    renderWithLanguage(<SchemesMarquee schemes={GOVT_SCHEMES} />, 'en');
    
    const pauseButton = screen.getByLabelText(/pause auto-scrolling/i);
    expect(pauseButton).toBeInTheDocument();
    
    fireEvent.click(pauseButton);
    expect(screen.getByLabelText(/resume auto-scrolling/i)).toBeInTheDocument();

    const leftButton = screen.getByLabelText(/scroll schemes left/i);
    const rightButton = screen.getByLabelText(/scroll schemes right/i);
    expect(leftButton).toBeInTheDocument();
    expect(rightButton).toBeInTheDocument();

    fireEvent.click(rightButton);
    fireEvent.click(leftButton);
  });
});
