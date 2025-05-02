// index.d.ts
declare module "*.hbs" {
  const value: (context: any) => string;
  export default value;
}
