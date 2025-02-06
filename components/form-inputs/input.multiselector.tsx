import { MultipleSelector } from "@/components/ui/multipleSelector";

import { FormFieldProvider } from "@/components/form-inputs/form.input.wrapper";
import { MultiSelectorProps } from "@/lib/types/form.inputs.types";
import { LoaderCircle } from "lucide-react";
import { memo } from "react";
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
}: MultiSelectorProps<TData, TName>) {
  return (
    <FormFieldProvider<TData, TName> name={name} label={label}>
      {({ field, fieldState }) => {
        const value = field.value;
        const setValue = field.onChange;

        return (
          <>
            <input hidden name={name} value={JSON.stringify(value)} onChange={setValue} />

            <div onBlur={field.onBlur} ref={field.ref} className="w-full">
              <MultipleSelector
                defaultOptions={options}
                placeholder={placeholder}
                triggerSearchOnFocus={triggerSearchOnFocus}
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
              />
            </div>
          </>
        );
      }}
    </FormFieldProvider>
  );
}

export default memo(MultiSelectorInput) as typeof MultiSelectorInput;
