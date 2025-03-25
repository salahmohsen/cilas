import { MultipleSelector, Option } from "@/components/ui/multipleSelector";

import { InputWrapper } from "@/components/form-inputs/form.input.wrapper";
import { MultipleSelectorInputProps } from "@/lib/types/form.inputs.types";
import { LoaderCircle } from "lucide-react";
import { memo, useCallback, useEffect, useState } from "react";
import { FieldPath, FieldValues } from "react-hook-form";

function MultiSelectorInput<TData extends FieldValues, TName extends FieldPath<TData>>({
  name,
  label,
  placeholder,
  options,
  emptyMsg,
  className,
  onSearch,
  triggerSearchOnFocus,
  getPreValuesAction,
  ...props
}: MultipleSelectorInputProps<TData, TName>) {
  const [actionPreValues, setActionPreValues] = useState<Option[]>([]);
  const [loadingPreValues, setLoadingPreValues] = useState(false);

  const fetchDefaultValues = useCallback(async () => {
    if (!getPreValuesAction) return;
    setLoadingPreValues(true);
    const defaultValues = await getPreValuesAction?.();
    setActionPreValues(defaultValues);
    setLoadingPreValues(false);
  }, [getPreValuesAction]);

  useEffect(() => {
    fetchDefaultValues();
  }, [fetchDefaultValues]);

  return (
    <InputWrapper<TData, TName> name={name} label={label}>
      {({ field, fieldState }) => {
        const value = actionPreValues.length ? actionPreValues : field.value;

        const setValue = field.onChange;

        return (
          <>
            <input hidden name={name} value={JSON.stringify(value)} onChange={setValue} />

            <div onBlur={field.onBlur} ref={field.ref} className="w-full">
              <MultipleSelector
                options={options}
                placeholder={loadingPreValues ? "Loading..." : placeholder}
                triggerSearchOnFocus={triggerSearchOnFocus}
                className="dark:bg-input/30"
                emptyIndicator={
                  <p className="flex w-full items-center justify-center text-sm leading-10 text-gray-600 dark:text-gray-400">
                    {emptyMsg}
                  </p>
                }
                badgeClassName={
                  "py-1 mx-1 text-zinc-800 bg-gray-100 hover:bg-gray-300 rounded-sm"
                }
                hidePlaceholderWhenSelected={true}
                value={value}
                onChange={setValue}
                loadingIndicator={
                  <div className="flex h-10 items-center justify-center">
                    <LoaderCircle className="animate-spin" />
                  </div>
                }
                onSearch={onSearch}
                {...props}
              />
            </div>
          </>
        );
      }}
    </InputWrapper>
  );
}

export default memo(MultiSelectorInput) as typeof MultiSelectorInput;
