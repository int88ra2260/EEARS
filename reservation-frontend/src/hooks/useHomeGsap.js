import { useRef } from 'react';

import { useGSAP } from '@gsap/react';

import gsap from 'gsap';

import { ScrollTrigger } from 'gsap/ScrollTrigger';



gsap.registerPlugin(useGSAP, ScrollTrigger);



const SECTION_HEADER_SELECTORS = [

  '.home-section__header > *',

  '.home-section__header--split > div > *',

  '.home-contact-grid__copy > *',

].join(', ');



const SECTION_ITEM_SELECTORS = [

  '.home-activity-tile',

  '.home-steps-rail__item',

  '.home-announce-card-link',

  '.home-faq__item',

  '.home-contact-card',

  '.home-section__footer',

  '.home-section__header-action',

  '.home-empty-state',

].join(', ');



/**

 * 首頁 GSAP 進場：Hero timeline + 區塊 ScrollTrigger（標題 stagger + 子項 stagger）

 */

export default function useHomeGsap() {

  const rootRef = useRef(null);



  useGSAP(

    () => {

      const root = rootRef.current;

      if (!root) return;



      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;



      if (prefersReduced) {

        gsap.set(root.querySelectorAll('.home-scroll-item, .home-section .home-reveal'), {

          autoAlpha: 1,

          y: 0,

          clearProps: 'all',

        });

        return;

      }



      const hero = root.querySelector('.home-hero');

      if (hero) {

        const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

        const heroFrame = hero.querySelector('.home-hero-desk');



        if (heroFrame) {

          tl.from(heroFrame, {

            y: 20,

            autoAlpha: 0,

            duration: 0.55,

          });

        }


        tl.from(

          hero.querySelectorAll('.home-hero-desk__copy > *, .home-hero-panel__quick-header > *'),

          {

            y: 18,

            autoAlpha: 0,

            duration: 0.55,

            stagger: 0.06,

          },

          '-=0.35',

        ).from(

          hero.querySelectorAll('.home-hero-quick-card'),

          {

            y: 12,

            autoAlpha: 0,

            duration: 0.45,

            stagger: 0.07,

          },

          '-=0.2',

        );

      }



      root.querySelectorAll('.home-section').forEach((section) => {

        const shell = section.querySelector('.home-shell');

        if (!shell) return;



        const headerEls = shell.querySelectorAll(SECTION_HEADER_SELECTORS);

        const gridItems = shell.querySelectorAll(SECTION_ITEM_SELECTORS);



        headerEls.forEach((el) => el.classList.add('home-scroll-item'));

        gridItems.forEach((el) => el.classList.add('home-scroll-item'));



        const sectionTl = gsap.timeline({

          scrollTrigger: {

            trigger: section,

            start: 'top 86%',

            once: true,

          },

        });



        if (headerEls.length) {

          sectionTl.from(headerEls, {

            y: 26,

            autoAlpha: 0,

            duration: 0.58,

            stagger: 0.09,

            ease: 'power2.out',

            immediateRender: false,

          });

        }



        if (gridItems.length) {

          sectionTl.from(

            gridItems,

            {

              y: 22,

              autoAlpha: 0,

              duration: 0.52,

              stagger: 0.07,

              ease: 'power2.out',

              immediateRender: false,

            },

            headerEls.length ? '-=0.28' : 0,

          );

        }

      });



      ScrollTrigger.refresh();

    },

    { scope: rootRef },

  );



  return rootRef;

}

