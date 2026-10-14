import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen from "./screens/HomeScreen";
import UsersScreen from "../src/screens/admin/UsersScreen";

const Stack = createNativeStackNavigator();

export default function CareerAssociateNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CareerHome" component={HomeScreen} />
      <Stack.Screen
        name="ViewAsUsers"
        component={UsersScreen}
        options={{ headerShown: true, title: "View as user" }}
      />
    </Stack.Navigator>
  );
}
