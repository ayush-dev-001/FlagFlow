/** A text field's value from a submitted form; FormData.get can also return a File. */
export const formText = (data: FormData, name: string) => {
  const value = data.get(name);
  return typeof value === 'string' ? value : '';
};
