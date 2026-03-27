// RealDeal — Scraper Registry
// Returns the best scraper for the current page.

/* global RealDeal */
RealDeal.Scrapers = (function () {
  'use strict';

  // Ordered by specificity — most specific first, generic last
  const SCRAPERS = [
    RealDeal.ScraperAmazon,
    RealDeal.ScraperWalmart,
    RealDeal.ScraperEbay,
    RealDeal.ScraperAliexpress,
    RealDeal.ScraperZalando,
    RealDeal.ScraperAboutyou,
    RealDeal.ScraperZara,
    RealDeal.ScraperHm,
    RealDeal.ScraperGeneric  // always last
  ];

  /**
   * Find the first scraper that can handle this page,
   * run it, and return the ScrapedProduct or null.
   */
  function scrapeCurrentPage() {
    for (const scraper of SCRAPERS) {
      try {
        if (scraper.canHandle()) {
          const result = scraper.scrape();
          if (result && result.currentPrice != null) {
            console.debug('[RealDeal] Scraped via', scraper.name, result);
            return result;
          }
        }
      } catch (err) {
        console.warn('[RealDeal] Scraper', scraper.name, 'threw:', err);
      }
    }
    return null;
  }

  return { scrapeCurrentPage };
})();
