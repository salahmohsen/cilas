import { clsx, type ClassValue } from "clsx";
import { RefObject } from "react";
import { twMerge } from "tailwind-merge";


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


export const shake = (divRef: RefObject<HTMLDivElement>) => {
};

export const isObjectEmpty = (obj: object) => Object.keys(obj).length === 0;

export function getSeason(date: string | Date) {
}

export const isURL = (str: string) => {
};

export const isArabic = (string: string) => {
  const pattern = new RegExp("^[p{Arabic}sp{N}]+$");
  return pattern.test(string);
};