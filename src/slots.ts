/**
 * Provides `Slot` and `Plug` mechanic.
 *
 * `Slot`s are places that other components can mount to using `Plug`s.
 * To define a slot mount-point, use `<Slot name="name" />`.
 *
 * @example
 * <SlotsProvider>
 *   <header>
 *     <Slot name="header" />
 *   </header>
 *
 *   <Plug slot="header" header="user-view">
 *     Im mouted in header!
 *   </Plug>
 * </SlotsProvider>
 *
 * @example
 *
 * // type-safe API
 * const [SomeSlot, SomePlug] = createSlotAndPlug("some-slot");
 *
 * const SomeComponent = () => (
 *   <>
 *     <SomeSlot />
 *     <SomePlug>test</SomePlug>
 *   </>
 * );
 *
 * @example
 *
 * // type-safe API
 * const SomeSlot = createSlot("some-slot");
 *
 * const SomeComponent = () => (
 *   <>
 *     <SomeSlot />
 *     <SomeSlot.Plug>test</SomeSlot.Plug>
 *   </>
 * );
 *
 * @see Slot
 * @see Plug
 * @see SlotProvider
 */
import * as React from 'react';
import sortBy from 'lodash.sortby';


/**
 * Configuration options for plug.
 */
export interface PlugOptions {
  /**
   * User-friendly display name.
   *
   * This can be used by the target slot e.g. for displaying your plug name in a menu or for debugging purposes.
   */
  name?: string;

  /**
   * Requested display order.
   *
   * This number is relative to the slot that renders the plug.
   * For plugs that should render before others, some low or negative number can be passed
   * so that the plug is inserted at the beginning.
   *
   * However, it is up to slot to respect the order
   */
  order?: number;

  /**
   * Any other data that should be kept with plug.
   *
   * The structure and semantics of this field are defined by the target slot.
   */
  extra?: any;
}


/**
 * PlugHandler function additional fields that get assigned to it
 */
interface PlugMeta extends PlugOptions {
  /**
   * Unique ID for plug instance.
   *
   * Can be used as a `key` prop during rendering.
   */
  readonly id: string;

  /**
   * Name of slot plug is connecting to.
   */
  readonly slotName: string;
}

/**
 * Type for a dynamic plug.
 */
export type PlugInstance<Params = {}, Result = React.ReactElement> = ((props: Params) => Result) & PlugMeta;


interface ContextType {
  slots: Record<string, PlugInstance<any, any>[]>;
  setPlug: (slot: string, id: string, renderer: PlugInstance) => void;
  removePlug: (slot: string, id: string) => void;
}

/**
 * Context instance of this module.
 */
const context = React.createContext<ContextType>(null as any);


/**
 * Hook that returns all plugs for specified slot name.
 *
 * This hook is meant for advanced use or more fine-grained control.
 * For most cases the `Slot` component, or `createSlot` should be used.
 *
 * In case no plugs have been registered or slot was not yet defined,
 * empty array is returned.
 *
 * @param name Slot name to fetch
 */
export function useSlot<P = {}, R = React.ReactElement>(name: string): readonly PlugInstance<P, R>[] {
  const ctx = React.useContext<ContextType>(context);

  if (!ctx) {
    throw new Error("Using <Slot> component or useSlot hook outside of <SlotProvider>");
  }

  return ctx.slots[name] || [];
}

/**
 * `Slot` component props.
 */
export interface SlotProps<P = undefined, R = React.ReactElement> {
  /**
   * Slot name to render.
   */
  name: string;

  /**
   * Limit of how many plugs should be rendered.
   */
  maxCount?: number;

  /**
   * Whenever plugs should be rendered in reverse order.
   */
  reversed?: boolean;

  /**
   * Parameter to pass to plugs.
   *
   * This field is mutually exclusive with `children` field.
   */
  params?: P;

  /**
   * Optional render function.
   *
   * Function takes pre-processed list of plugs (reversed and limited if specified in other props)
   * and should return a React element (e.g. a fragment).
   *
   * This field is mutually exclusive with `params` field.
   *
   * @param plugs
   */
  children?: (plugs: readonly PlugInstance<P, R>[]) => React.ReactElement;
}

/**
 * React component that renders all registered plugs for specified slot name.
 *
 * Rendering can be customized using render function as children.
 *
 * @example
 *
 * <Slot name="header" />
 *
 * @example
 *
 *  <Slot name="header">
 *    {plugs => (
 *      <React.Fragment>
 *        {plugs.map(Plug => (
 *          <Plug key={Plug.id} myCustomProp={5} />
 *        ))}
 *      </React.Fragment>
 *    )}
 *  </Slot>
 */
export function Slot<T>(props: React.PropsWithoutRef<SlotProps<T>>) {
  const {name, maxCount, reversed, children, params, ...rest} = props;
  let slots = useSlot(name);

  if (params && children) {
    throw Error("Cannot specify render function and params props at the same time");
  }

  return React.useMemo(() => {
    if (maxCount !== undefined) {
      slots = slots.slice(0, maxCount);
    }

    if (reversed !== undefined) {
      slots = [...slots].reverse();
    }

    if (children) {
      return children(slots);
    }

    return (
      React.createElement(React.Fragment, {},
        slots.map((R, i) => React.createElement(R, { key: i.toString(), ...params}))
      )
    );
  }, [reversed, maxCount, params, slots, children]);
}

/**
 * Creates a hook that defines a new plug.
 *
 * This function is rather low-level and probably `<Plug>` component
 * or `createSlotAndPlug` is a better choice.
 *
 * @param slot Slot name
 * @param id Unique plug name
 * @param renderer Function to render components
 * @param deps Array of dependencies to trigger the update
 * @param options Additional plug options
 * @see createSlotAndPlug
 * @see createSlot
 * @see Plug
 */
export function usePlug<T = {}, R = React.ReactElement>(
  slot: string,
  id: string,
  renderer: (props: T) => R,
  deps: any[],
  options: PlugOptions,
): void {
  const slotContext = React.useContext<ContextType>(context);

  if (!slotContext) {
    throw new Error("Using <Plug> component or usePlug hook outside of <SlotProvider>");
  }

  const {setPlug, removePlug} = slotContext;
  const {name, order, extra} = options;

  Object.assign(renderer, {slotName: name, extra, order});

  React.useEffect(
    () => {
      setPlug(slot, id, renderer as PlugInstance<any, any>);
      return () => removePlug(slot, id);
    },
    deps, // eslint-disable-line react-hooks/exhaustive-deps
  );
}

/**
 * Plug component properties.
 *
 * @see Plug
 */
export interface PlugProps<P = {}, R = React.ReactElement> extends PlugOptions {
  /**
   * Name of the slot to connect to
   */
  slot: string;

  /**
   * Unique name of the plug
   */
  id: string;

  /**
   * Children can be either a casual React elements or a render function
   */
  children: React.ReactNode | React.ReactElement[] | ((props: P) => R);

  /**
   * Optional array of dependencies to trigger the update
   */
  deps?: any[];
}

type Plug<P = {}, R = React.ReactElement> = React.FC<PlugProps<P, R>>;

/**
 * Plug component.
 *
 * Connects to specified slot and adds `children` to it.
 *
 * Children of this component can be normal react sub-components that will be mounted in the
 * target slot, or a render function can take slot parameters.
 *
 * Slot name should be imported from target module to prevent any typing errors.
 * More type-safe approach is to use `createSlotAndPlug` that creates a slot and plug components
 * with bound name.
 *
 * @param slot Name of the target slot
 * @param id Unique name of the plug
 * @param deps Optional list of dependencies to trigger the update
 * @param children Contents to mount to slot
 * @param options Additional plug options
 */
export const Plug: Plug = ({ slot, id, deps = [], children, ...options }) => {
  const renderer = (typeof children === 'function') ? children : () => children! as any;
  usePlug(slot, id, renderer as any, deps, options);
  return null;
};

/**
 * Slot component with a defined name.
 */
export type BoundPlugComponent<P, R> = React.FC<Omit<PlugProps<P, R>, 'slot'>>;

/**
 * Plug component bound to a Slot.
 */
export type BoundSlotComponent<P, R> = React.FC<Omit<SlotProps<P, R>, 'name'>> & {
  slotName: string;
  Plug: BoundPlugComponent<P, R>;
};

/**
 * Creates a named Slot component.
 *
 * @param name Name of the slot
 */
export function createSlot<P, R = React.ReactElement>(name: string): BoundSlotComponent<P, R> {
  const slot: BoundSlotComponent<P, R> = (props) => React.createElement(Slot, { name, ...props as any });
  slot.slotName = name;
  slot.Plug = createPlugComponent<P, R>(name);
  return slot;
}

function createPlugComponent<P, R>(slotName: string): BoundPlugComponent<P, R> {
  const plugComponent: BoundPlugComponent<P, R> = (props) => React.createElement(Plug, { slot: slotName, ...props });
  plugComponent.displayName = `Slot(${slotName})`;
  return plugComponent;
}

/**
 * Creates a named Slot component and a Plug component bound to it.
 *
 * This is the recommended way to create slots.
 *
 * @param name Name of the slot
 */
export function createSlotAndPlug<P = {}, R = React.ReactElement>(name: string)
  : [BoundSlotComponent<P, R>, BoundPlugComponent<P, R>] {
  const boundSlot = createSlot<P, R>(name);
  return [boundSlot, boundSlot.Plug];
}

/**
 * Component that provides slot and plugs context down the component tree.
 *
 * This component is required for `Plug` and `Slot` components to work.
 */
export const SlotProvider: React.FC = ({children}) => {
  const setPlug = (slot: string, id: string, renderer: PlugInstance) => {
    Object.assign(renderer, {id});

    setSlots((prevState: ContextType) => ({
      ...prevState,
      slots: {
        ...prevState.slots,
        [slot]: sortBy(
          [...(prevState.slots[slot] || []).filter(e => e.id !== id), renderer],
          e => e.order || 0,
        ),
      },
    }));
  };

  const removePlug = (slot: string, name: string) => {
    setSlots((prevState: ContextType) => ({
      ...prevState,
      slots: {
        ...prevState.slots,
        [slot]: sortBy((prevState.slots[slot] || []).filter((e: any) => e.id !== name), e => e.order || 0),
      },
    }));
  };

  const initialSlots: ContextType = {
    slots: {},
    setPlug,
    removePlug,
  };

  const [slots, setSlots] = React.useState(initialSlots);
  return (
    React.createElement(context.Provider, {value: slots}, children)
  );
};
