export default defineAppConfig({
  ui: {
    colors: {
      primary: 'brand',
      neutral: 'umber',
    },

    button: {
      compoundVariants: [
        { color: 'neutral', variant: ['ghost', 'outline'], class: 'hover:bg-accented active:bg-accented' },
      ],
    },

    header: {
      slots: {
        root: 'border-transparent bg-desk/80',
        title: 'items-center gap-2',
      },
    },

    footer: {
      slots: {
        root: 'border-t border-default',
        container: 'flex flex-wrap items-center justify-between gap-4 py-8 lg:py-8',
        left: 'order-1 mt-0 flex-none justify-start lg:flex-none',
        right: 'order-3 flex-none gap-x-1.5 lg:flex-none',
      },
    },

    pageHero: {
      slots: {
        container: 'py-24 sm:py-24 lg:py-24',
        headline: 'text-sm font-semibold uppercase tracking-[0.1em]',
        title: 'mx-auto max-w-[20ch] font-display text-[clamp(2.5rem,7vw,4.25rem)] leading-[1.05] tracking-[-0.035em] text-balance',
        description: 'mx-auto mt-5 max-w-[46ch] text-pretty',
        footer: 'mt-9',
        links: 'gap-3',
      },
    },
  },
})
