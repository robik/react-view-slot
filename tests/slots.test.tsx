import * as React from 'react';
import {render, shallow} from 'enzyme';

import { Slot, Plug } from "../src";
import {SlotProvider} from "../src/slots";

describe('<Plug />', () => {
  it('requires context', () => {
    expect(() => (
      shallow(<Plug id="test"/>)
    )).toThrow()
  });
});


describe('<Slot />', () => {
  it('requires context', () => {
    expect(() => (
      shallow(<Slot name="test"/>)
    )).toThrow()
  });

  it('passes params', () => {
    render(
      <SlotProvider>
        <Slot name="test" params={{text: "test", number: 1234}} />
        <Plug name="test" id="foo">
          {({text, number}) => (
            <div id="plug">
              {text}{number}
            </div>
          )}
        </Plug>
      </SlotProvider>
    )
  });
});
