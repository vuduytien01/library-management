const React = require('react');
const { View, Text, TouchableOpacity, TextInput: RNTextInput } = require('react-native');

const Button = ({ children, onPress, disabled }) =>
  React.createElement(
    TouchableOpacity,
    { onPress, disabled, accessibilityRole: 'button' },
    React.createElement(Text, null, children)
  );

const PaperTextInput = ({ label, value, onChangeText, secureTextEntry }) =>
  React.createElement(RNTextInput, {
    accessibilityLabel: label,
    value,
    onChangeText,
    secureTextEntry,
    testID: label,
  });

const Card = ({ children }) => React.createElement(View, null, children);
Card.Title = ({ title, subtitle }) =>
  React.createElement(Text, null, `${title} ${subtitle != null ? subtitle : ''}`);
Card.Content = ({ children }) => React.createElement(View, null, children);
Card.Actions = ({ children }) => React.createElement(View, null, children);

module.exports = {
  Button,
  TextInput: PaperTextInput,
  Card,
  ActivityIndicator: () => React.createElement(View, { testID: 'activity-indicator' }),
  Provider: ({ children }) => React.createElement(View, null, children),
  PaperProvider: ({ children }) => React.createElement(View, null, children),
  Text: ({ children }) => React.createElement(Text, null, children),
};
