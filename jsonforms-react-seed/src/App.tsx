import { materialCells, materialRenderers } from '@jsonforms/material-renderers';
import { JsonForms } from '@jsonforms/react';
import {useEffect, useState} from 'react';
import './App.css';
import RatingControl from './RatingControl';
import ratingControlTester from './ratingControlTester';

const renderers = [
  ...materialRenderers,
  //register custom renderers
  {tester: ratingControlTester, renderer: RatingControl},
];

const SenderControl = ({port, data}: { data: any, port: MessagePort | null }) => {
  if (port === null || !data || Object.entries(data).length === 0) {
    return (<div></div>);
  }
  port.postMessage({type: 'data', data: data});
  window.parent.postMessage({type: 'render_iframe'}, '*');
  return (<div></div>);
}

function requestPort(): Promise<MessagePort> {
  return new Promise((resolve, reject) => {
    // @ts-ignore
    if(window.form_message_port) {
      // @ts-ignore
      resolve(window.form_message_port);
      return;
    }
    window.addEventListener('message', (e) => {
      if (e?.ports.length > 0) {
        resolve(e.ports[0]);
      }
    });
  });
}

const App = () => {
  console.log("APP TSX, on load");
  const [data, setData] = useState<any>({});
  const [port, setPort] = useState<any>(undefined);
  const [schema, setSchema] = useState<any>(undefined);
  const [uischema, setUISchema] = useState<any>(undefined);
  useEffect(() => {
    (async () => {
      const port = await requestPort();
      port.onmessage = (event: MessageEvent) => {
        console.log("APP TSX, on message", event);
        if (event.data.type === 'setOptions') {
          setSchema(event.data.options.schema ?? undefined);
          setData(event.data.options.data ?? {});
          setUISchema(event.data.options.uischema ?? undefined);
        }
      };
      // @ts-ignore
      setPort(port);
      // @ts-ignore
      port.postMessage({type: 'ready'});
      console.log("APP TSX, on ready");
    })();
  }, []);

  if (schema === undefined) {
    return <div></div>;
  }

  return (
    <>
      <SenderControl port={port} data={data}/>
      <JsonForms
        schema={schema}
        uischema={uischema}
        data={data}
        renderers={renderers}
        cells={materialCells}
        onChange={({errors, data}) => {
          if (errors?.length === 0) {
            setData(data);
          }
        }}
      />
    </>
  );
};

export default App;
