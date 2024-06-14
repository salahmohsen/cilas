import { useFormContext } from "react-hook-form";

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../../../../components/ui/form";
import MultipleSelector from "@/components/ui/multipleSelector";

import { MultiSelectorProps } from "../../../../types/form.inputs";
import { memo } from "react";

export const MultiSelectorInput: React.FC<MultiSelectorProps> = memo(
  function MultiSelectorInput({
    name,
    label,
    placeholder,
    options,
    emptyMsg,
    className,
  }) {
    const { control } = useFormContext();
    return (
      <FormField
        control={control}
        name={name}
        render={({ field }) => (
          <FormItem className={className}>
            <FormLabel>{label}</FormLabel>
            <FormControl>
              <>
                <input
                  hidden
                  name={name}
                  value={JSON.stringify(field.value)}
                  onChange={field.onChange}
                />

                <div onBlur={field.onBlur} ref={field.ref}>
                  <MultipleSelector
                    defaultOptions={options}
                    placeholder={placeholder}
                    emptyIndicator={
                      <p className="text-center text-lg leading-10 text-gray-600 dark:text-gray-400">
                        {emptyMsg}
                      </p>
                    }
                    badgeClassName={
                      "py-1 mx-1 text-zinc-800 bg-gray-100 hover:bg-gray-300 rounded-sm"
                    }
                    hidePlaceholderWhenSelected={true}
                    value={field.value}
                    onChange={(value) => field.onChange(value)}
                  />
                </div>
              </>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    );
  },
);
