import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { RefObject } from "react";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const shake = (divRef: RefObject<HTMLDivElement>) => {
  divRef.current?.classList.add("animate-shake");
  setTimeout(() => {
    divRef.current?.classList.remove("animate-shake");
  }, 1000);
};

export const isObjectEmpty = (obj: object) => Object.keys(obj).length === 0;

export function getSeason(dateString) {
  // Convert the input string to a Date object
  const date = new Date(dateString);

  // Extract the month and day
  const month = date.getMonth() + 1; // getMonth() is zero-based
  const day = date.getDate();

  // Determine the season based on month and day
  if ((month === 12 && day >= 21) || (month <= 3 && (month < 3 || day <= 20))) {
    return "Winter";
  } else if (
    (month === 3 && day >= 21) ||
    (month <= 6 && (month < 6 || day <= 20))
  ) {
    return "Spring";
  } else if (
    (month === 6 && day >= 21) ||
    (month <= 9 && (month < 9 || day <= 22))
  ) {
    return "Summer";
  } else if (
    (month === 9 && day >= 23) ||
    (month <= 12 && (month < 12 || day <= 20))
  ) {
    return "Fall";
  }
}

export const isURL = (str: string) => {
  const pattern = new RegExp(
    "^(https?:\\/\\/)?" + // protocol
      "((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.?)+[a-z]{2,}|" + // domain name
      "((\\d{1,3}\\.){3}\\d{1,3}))" + // OR ip (v4) address
      "(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*" + // port and path
      "(\\?[;&a-z\\d%_.~+=-]*)?" + // query string
      "(\\#[-a-z\\d_]*)?$",
    "i",
  );
  return pattern.test(str);
};

export const isArabic = (string: string) => {
  const pattern = new RegExp("^[p{Arabic}sp{N}]+$");
  return pattern.test(string);
};
