import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Constants from "expo-constants";
import { useAuth } from "../context/AuthContext";
import { useWorkspace } from "../context/WorkspaceContext";
import LoginScreen from "../screens/auth/LoginScreen";
import RegisterScreen from "../screens/auth/RegisterScreen";
import { InvoiceNavigator } from "../../invoice";
import { SnackifyNavigator } from "../../snackify";
import { CareerAssociateNavigator } from "../../careerAssociate";

const Stack = createNativeStackNavigator();
const allowSelfRegistration = Boolean(
  (Constants.expoConfig?.extra || Constants.manifest?.extra)?.allowSelfRegistration,
);

function ProductHost() {
  const { workspaceId } = useWorkspace();
  if (workspaceId === "snackify") return <SnackifyNavigator />;
  if (workspaceId === "career") return <CareerAssociateNavigator />;
  return <InvoiceNavigator />;
}

export default function RootNavigator() {
  const { user } = useAuth();

  if (!user) {
    return (
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: "fade",
          animationDuration: 220,
          contentStyle: { backgroundColor: "#F4FBF8" },
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        {allowSelfRegistration ? (
          <Stack.Screen name="Register" component={RegisterScreen} />
        ) : null}
      </Stack.Navigator>
    );
  }

  return <ProductHost />;
}
