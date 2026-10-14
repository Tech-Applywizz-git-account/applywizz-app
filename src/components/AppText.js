import React from "react";
import { Text as RNText, TextInput as RNTextInput } from "react-native";
import { withPoppins, FONT } from "../typography";

/**
 * App-wide Text — always Poppins (Light / Regular / Medium from fontWeight).
 */
export function Text({ style, ...props }) {
  return <RNText {...props} style={withPoppins(style)} />;
}

/**
 * App-wide TextInput — Poppins Regular by default; respects fontWeight if set.
 */
export function TextInput({ style, ...props }) {
  return (
    <RNTextInput
      {...props}
      style={withPoppins([{ fontFamily: FONT.regular }, style])}
    />
  );
}

export default Text;
