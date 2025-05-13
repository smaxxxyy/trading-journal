const { override, adjustStyleLoaders } = require('customize-cra');

module.exports = override(
  adjustStyleLoaders(({ use }) => {
    use.forEach((loader) => {
      if (/postcss-loader/.test(loader.loader)) {
        loader.options.postcssOptions.plugins = [
          require('@tailwindcss/postcss')(),
        ];
      }
    });
  })
);