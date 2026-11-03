import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';

export default {
  input: 'src/solar-dashboard.js',
  output: {
    file: 'dist/solar-dashboard.js',
    format: 'es',
    inlineDynamicImports: true,
    banner: `/*!
Solar Dashboard includes Three.js (Copyright 2010-2026 three.js authors)
and Astronomy Engine (Copyright 2019-2023 Don Cross).
The MIT License


Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

Star catalogue: HYG v4.1, David Nash / Astronexus, CC BY-SA 4.0.
Modified to retain 925 bright-star names, J2000 RA/Dec, magnitude and color.
Source: https://github.com/astronexus/HYG-Database/blob/main/hyg/CURRENT/hygdata_v41.csv
Data license: https://creativecommons.org/licenses/by-sa/4.0/
*/`,
  },
  plugins: [
    resolve(),
    terser({
      format: { comments: /^!/ },
    }),
  ],
};
