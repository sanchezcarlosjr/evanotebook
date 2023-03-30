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
  port.postMessage(data);
  return (<div></div>);
}

const App = () => {
  const [data, setData] = useState<any>({});
  const [port, setPort] = useState<any>(undefined);
  const [schema, setSchema] = useState<any>(undefined);
  const [uischema, setUISchema] = useState<any>(undefined);
  useEffect(() => {
    window.onmessage = function(e) {
      if (e.ports.length > 0) {
        setPort(e.ports[0]);
        e.ports[0].onmessage = (event: MessageEvent) => {
          setSchema(event.data.schema ?? undefined);
          setData(event.data.data ?? {});
          setUISchema(event.data.uischema ?? undefined);
        };
      }
    };
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
