import { ArrowRight, Star, Shield, Truck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import heroImage from "@/assets/hero-phones.jpg";
import sparePartsImage from "@/assets/spar-parts.png";

export function HeroSection() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden bg-gradient-hero">
      <div className="absolute inset-0 bg-black/20" />
      
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30"
        style={{ backgroundImage: `url(${heroImage})` }}
      />

      {/* S37 — phone padding trimmed (was px-8 + px-4 = 96px of gutters, leaving ~224px at 320px, which the
          nowrap French CTA overflowed). S38 rebuilds this section; this is only the overflow fix. */}
      <div className="container mx-auto px-4 sm:px-8 md:px-12 lg:px-16 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Content */}
          <div className="text-center lg:text-left space-y-8 px-0 py-8 sm:px-4 md:px-6 lg:px-8">
            <div className="space-y-4">
              <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight">
                {t('hero.title')}
                <span className="block bg-gradient-to-r from-white to-accent bg-clip-text text-transparent">
                  {t('hero.subtitle')}
                </span>
              </h1>
              <p className="text-xl text-white/90 max-w-2xl">
                {t('hero.description')}
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Button 
                size="lg" 
                className="bg-white text-primary hover:bg-white/90 shadow-glow"
                onClick={() => navigate('/products')}
              >
                {t('hero.browse')}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="border-white text-white bg-black hover:bg-black/80 hover:text-white dark:bg-white dark:text-black dark:hover:bg-white/90"
                onClick={() => {
                  // Scroll to footer contact section
                  const footer = document.querySelector('footer');
                  if (footer) {
                    footer.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
              >
                {t('hero.learn')}
              </Button>
            </div>

            {/* Features */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-8">
              <div className="flex items-center space-x-3 justify-center lg:justify-start">
                <div className="flex-shrink-0 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center glass">
                  <Star className="h-5 w-5 text-white" />
                </div>
                <span className="text-white font-medium">{t('hero.quality')}</span>
              </div>
              <div className="flex items-center space-x-3 justify-center lg:justify-start">
                <div className="flex-shrink-0 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center glass">
                  <Shield className="h-5 w-5 text-white" />
                </div>
                <span className="text-white font-medium">{t('hero.warranty')}</span>
              </div>
              <div className="flex items-center space-x-3 justify-center lg:justify-start">
                <div className="flex-shrink-0 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center glass">
                  <Truck className="h-5 w-5 text-white" />
                </div>
                <span className="text-white font-medium">{t('hero.delivery')}</span>
              </div>
            </div>
          </div>

          {/* Floating Product Card */}
          <div className="hidden lg:block flex justify-center items-center px-4 md:px-6 lg:px-8">
            <div className="relative">
              <div className="glass rounded-2xl p-6 animate-float w-[28rem] h-[34rem]">
                <div className="bg-white rounded-xl p-6 shadow-elegant w-full h-[32rem] flex flex-col">
                  <div className="bg-gradient-to-br from-primary/20 to-accent/20 rounded-lg mb-8 flex items-center justify-center overflow-hidden h-[30rem]">
                    <img
                      src={sparePartsImage}
                      alt={t('hero.sparePartsTitle')}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="text-2xl font-semibold text-foreground dark:text-black mb-4">{t('hero.sparePartsTitle')}</h3>
                      <p className="text-muted-foreground text-lg mb-6">{t('hero.sparePartsDescription')}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xl font-bold text-primary">{t('hero.sparePartsPrice')}</span>
                      <Button size="lg" onClick={() => navigate('/products')} style={{ visibility: 'hidden' }}>{t('products.viewDetails')}</Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}