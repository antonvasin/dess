import { MyComponent } from "./custom2.tsx";

export function hello(): void {
  console.log("Hello world");
}

console.log(MyComponent({}));
