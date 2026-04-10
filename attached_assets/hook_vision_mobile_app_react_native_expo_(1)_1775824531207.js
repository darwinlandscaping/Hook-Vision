import React, { useState } from 'react';
import { View, Text, Button, Image, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export default function App() {
  const [image, setImage] = useState(null);
  const [analysis, setAnalysis] = useState(null);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
      setAnalysis(null);
    }
  };

  const runFakeAI = () => {
    setAnalysis({
      fishCount: 3,
      depth: '9.2m',
      distance: '12m right',
      species: 'Barramundi (72%)',
      suggestion: 'Cast 15m ahead, soft plastic, slow retrieve',
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🎣 HookVision Mobile</Text>

      <Button title="Upload Screenshot" onPress={pickImage} />

      {image && (
        <Image source={{ uri: image }} style={styles.image} />
      )}

      {image && (
        <Button title="Analyze" onPress={runFakeAI} />
      )}

      {analysis && (
        <View style={styles.results}>
          <Text>Fish: {analysis.fishCount}</Text>
          <Text>Depth: {analysis.depth}</Text>
          <Text>Distance: {analysis.distance}</Text>
          <Text>Species: {analysis.species}</Text>
          <Text>Suggestion: {analysis.suggestion}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
  },
  image: {
    width: 300,
    height: 200,
    marginVertical: 20,
  },
  results: {
    marginTop: 20,
    alignItems: 'flex-start',
  },
});
