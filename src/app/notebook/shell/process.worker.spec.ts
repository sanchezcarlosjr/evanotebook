import {precompileJS} from "./precompile";

describe('Process Worker Test', () => {
    fit('should precompile correctly', async () => {
        expect(precompileJS("1")).toEqual("export default 1;");
        expect(precompileJS(`
          const t = 0;
          t;
      `)).toEqual(`const t = 0;
export default t;`);
      expect(precompileJS(`
          import * as React from 'react';
          const t = 0;
          t;
      `)).toEqual(`import * as React from 'react';
const t = 0;
export default t;`);
      expect(precompileJS(`
          import * as React from 'react';
          const y = await new Promise(r => r(1));
          const t = 0;
          t;
      `)).toEqual(`import * as React from 'react';
const y = await new Promise(r => r(1));
const t = 0;
export default t;`);
      expect(precompileJS(`
          import * as React from 'react';
          const y = await new Promise(r => r(1));
          const t = 10_00_00.515151666;
          t;
      `)).toEqual(`import * as React from 'react';
const y = await new Promise(r => r(1));
const t = 10_00_00.515151666;
export default t;`);
      expect(precompileJS(`
          import * as React from 'react';
          const y = await new Promise(r => r(1));
          const t = 10_00_00.515151666;
          export default t;
      `)).toEqual(`import * as React from 'react';
const y = await new Promise(r => r(1));
const t = 10_00_00.515151666;
export default t;`);
      expect(precompileJS(`
          import * as React from 'react';
          const y = await new Promise(r => r(1));
          const t = 10_00_00.515151666;
          "123"
      `)).toEqual(`import * as React from 'react';
const y = await new Promise(r => r(1));
const t = 10_00_00.515151666;
export default "123";`);
      expect(precompileJS(`
          import * as React from 'react';
          const y = await new Promise(r => r(1));
          const t = 10_00_00.515151666;
          new Set([1,2,3,4])
      `)).toEqual(`import * as React from 'react';
const y = await new Promise(r => r(1));
const t = 10_00_00.515151666;
export default new Set([1, 2, 3, 4]);`);
      expect(precompileJS(`
          import * as React from 'react';
          const y = await new Promise(r => r(1));
          const t = 10_00_00.515151666;
          new Set([1,2,3,4])
          /*
             A random comment
          */
      `)).toEqual(`import * as React from 'react';
const y = await new Promise(r => r(1));
const t = 10_00_00.515151666;
export default new Set([1, 2, 3, 4]);`);
      expect(precompileJS(`
          import * as React from 'react';
          const y = await new Promise(r => r(1));
          const t = 10_00_00.515151666;
          () => 1;
          /*
             A random comment
          */
      `)).toEqual(`import * as React from 'react';
const y = await new Promise(r => r(1));
const t = 10_00_00.515151666;
export default (() => 1);`);
    }
    );
  }
);
