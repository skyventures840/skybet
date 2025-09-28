module.exports = {
  plugins: [
    // Autoprefixer for cross-browser compatibility
    require('autoprefixer')({
      overrideBrowserslist: [
        '> 1%',
        'last 2 versions',
        'not dead',
        'not op_mini all',
        'iOS >= 9',
        'Android >= 4.4'
      ],
      flexbox: 'no-2009',
      grid: 'autoplace'
    }),
    
    // CSSNano for minification and optimization
    require('cssnano')({
      preset: ['default', {
        discardComments: {
          removeAll: true,
        },
        normalizeWhitespace: true,
        colormin: true,
        minifyFontValues: true,
        minifySelectors: true,
        mergeLonghand: true,
        mergeRules: true,
        reduceIdents: false, // Keep keyframe names
        reduceInitial: true,
        reduceTransforms: true,
        uniqueSelectors: true,
        zindex: false, // Don't reorder z-index values
        discardUnused: true,
        discardDuplicates: true,
        discardEmpty: true,
        discardOverridden: true,
        mergeIdents: false, // Don't merge identical selectors
        minifyGradients: true,
        minifyParams: true,
        minifySelectors: true,
        normalizeCharset: true,
        normalizeDisplayValues: true,
        normalizePositions: true,
        normalizeRepeatStyle: true,
        normalizeString: true,
        normalizeTimingFunctions: true,
        normalizeUnicode: true,
        normalizeUrl: true,
        orderedValues: true,
        reduceFunctions: true,
        reduceInitial: true,
        reduceTransforms: true,
        uniqueSelectors: true
      }]
    }),
    
    // PostCSS Preset Env for modern CSS features
    require('postcss-preset-env')({
      stage: 3,
      features: {
        'custom-properties': true,
        'nesting-rules': true,
        'custom-media-queries': true,
        'media-query-ranges': true,
        'logical-properties-and-values': true,
        'overflow-property': true,
        'place-properties': true,
        'double-position-gradients': true,
        'color-functional-notation': true,
        'cascade-layers': true,
        'clamp': true,
        'logical-properties-and-values': true,
        'overflow-property': true,
        'place-properties': true,
        'double-position-gradients': true,
        'color-functional-notation': true,
        'cascade-layers': true
      },
      autoprefixer: false, // Already handled above
      preserve: false
    }),
    
    // PostCSS Import for handling @import statements
    require('postcss-import')({
      path: ['src/styles']
    }),
    
    // PostCSS Custom Properties for better browser support
    require('postcss-custom-properties')({
      preserve: false,
      importFrom: [
        {
          customProperties: {
            '--primary-green': '#00ff88',
            '--secondary-green': '#00cc6a',
            '--dark-bg': '#0a0a0a',
            '--card-bg': '#1a1a1a',
            '--sidebar-bg': '#111111',
            '--header-bg': '#1a1a1a',
            '--text-primary': '#ffffff',
            '--text-secondary': '#cccccc',
            '--text-muted': '#888888',
            '--border-color': '#333333',
            '--hover-bg': '#2a2a2a',
            '--success': '#00ff88',
            '--warning': '#ffaa00',
            '--error': '#ff4444'
          }
        }
      ]
    }),
    
    // PostCSS Flexbox for better flexbox support
    require('postcss-flexbugs-fixes'),
    
    // PostCSS Focus Visible for better focus management
    require('postcss-focus-visible'),
    
    // PostCSS Focus Within for better focus management
    require('postcss-focus-within'),
    
    // PostCSS Logical for logical properties
    require('postcss-logical')({
      dir: 'ltr'
    }),
    
    // PostCSS Page Break for print styles
    require('postcss-page-break'),
    
    // PostCSS Place for place properties
    require('postcss-place'),
    
    // PostCSS Replace for replacing values
    require('postcss-replace')({
      pattern: /var\(--([^)]+)\)/g,
      data: {
        'spacing-xs': '4px',
        'spacing-sm': '8px',
        'spacing-md': '16px',
        'spacing-lg': '24px',
        'spacing-xl': '32px',
        'spacing-2xl': '48px',
        'spacing-3xl': '64px',
        'font-size-xs': '12px',
        'font-size-sm': '14px',
        'font-size-base': '16px',
        'font-size-lg': '18px',
        'font-size-xl': '20px',
        'font-size-2xl': '24px',
        'font-size-3xl': '28px',
        'font-size-4xl': '32px',
        'radius-sm': '4px',
        'radius-md': '8px',
        'radius-lg': '12px',
        'radius-xl': '16px',
        'transition-fast': '0.2s ease',
        'transition-base': '0.3s ease',
        'transition-slow': '0.5s ease',
        'z-dropdown': '1000',
        'z-sticky': '1020',
        'z-fixed': '1030',
        'z-modal-backdrop': '1040',
        'z-modal': '1050',
        'z-popover': '1060',
        'z-tooltip': '1070'
      }
    })
  ]
};
