import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { AnalysisCard } from "@/components/AnalysisCard";
import { SonarPulse } from "@/components/SonarPulse";
import { useColors } from "@/hooks/useColors";
import { useHistory } from "@/context/HistoryContext";

interface FishAnalysis {
  fishCount: number;
  depth: string;
  distance: string;
  species: string;
  confidence: number;
  suggestion: string;
  lure?: string;
  technique?: string;
  rig?: string;
  waterTemp?: string;
  bottomType?: string;
  sonarModel?: string | null;
}

export default function AnalyzeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addEntry } = useHistory();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<FishAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cameraScale = useSharedValue(1);
  const galleryScale = useSharedValue(1);
  const analyzeScale = useSharedValue(1);

  const animatedCameraStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cameraScale.value }],
  }));
  const animatedGalleryStyle = useAnimatedStyle(() => ({
    transform: [{ scale: galleryScale.value }],
  }));
  const animatedAnalyzeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: analyzeScale.value }],
  }));

  const handleImageSelected = useCallback(
    (uri: string, base64: string | null | undefined) => {
      setImageUri(uri);
      setImageBase64(base64 ?? null);
      setAnalysis(null);
      setError(null);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    []
  );

  const openCamera = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Camera Permission Required",
        "Please allow camera access so you can photograph your sonar screen directly.",
        [{ text: "OK" }]
      );
      return;
    }

    cameraScale.value = withSpring(0.92, {}, () => {
      cameraScale.value = withSpring(1);
    });

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      base64: true,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      handleImageSelected(result.assets[0].uri, result.assets[0].base64);
    }
  }, [cameraScale, handleImageSelected]);

  const openGallery = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please allow access to your photo library.");
      return;
    }

    galleryScale.value = withSpring(0.92, {}, () => {
      galleryScale.value = withSpring(1);
    });

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      base64: true,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      handleImageSelected(result.assets[0].uri, result.assets[0].base64);
    }
  }, [galleryScale, handleImageSelected]);

  const analyzeImage = useCallback(async () => {
    if (!imageBase64) return;

    analyzeScale.value = withSpring(0.96, {}, () => {
      analyzeScale.value = withSpring(1);
    });

    setLoading(true);
    setError(null);
    setAnalysis(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const domain = process.env.EXPO_PUBLIC_DOMAIN;
      const baseUrl = domain ? `https://${domain}` : "";
      const response = await fetch(`${baseUrl}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64 }),
      });

      if (!response.ok) {
        let errMsg = "Analysis failed. Please try again.";
        try {
          const errBody = await response.json();
          if (errBody?.error) errMsg = errBody.error;
        } catch {
          // non-JSON error body, use default
        }
        throw new Error(errMsg);
      }

      const data: FishAnalysis = await response.json();
      setAnalysis(data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (imageUri) {
        addEntry({
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          imageUri,
          timestamp: Date.now(),
          fishCount: data.fishCount,
          species: data.species,
          depth: data.depth,
          suggestion: data.suggestion,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }, [imageBase64, imageUri, addEntry, analyzeScale]);

  const topPad = Platform.OS === "web" ? 0 : insets.top;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: topPad + 16,
          paddingBottom: Platform.OS === "web" ? 70 : insets.bottom + 24,
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={[styles.appName, { color: colors.primary }]}>HookVision</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          AI-powered sonar analysis
        </Text>
      </View>

      {!imageUri ? (
        <View style={styles.emptyState}>
          <SonarPulse size={80} active />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            Scan your sonar
          </Text>
          <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
            Point your phone at the sonar screen or upload a screenshot. Get instant AI advice on species, depth, lures and technique.
          </Text>

          {/* Camera — primary action */}
          <Animated.View style={[animatedCameraStyle, styles.fullWidth]}>
            <TouchableOpacity
              style={[styles.cameraBtn, { backgroundColor: colors.primary }]}
              onPress={openCamera}
              activeOpacity={0.85}
            >
              <Feather name="camera" size={20} color={colors.primaryForeground} />
              <Text style={[styles.cameraBtnText, { color: colors.primaryForeground }]}>
                Take Photo of Sonar
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Gallery — secondary */}
          <Animated.View style={[animatedGalleryStyle, styles.fullWidth]}>
            <TouchableOpacity
              style={[styles.galleryBtn, { backgroundColor: colors.secondary, borderColor: colors.border }]}
              onPress={openGallery}
              activeOpacity={0.8}
            >
              <Feather name="image" size={18} color={colors.foreground} />
              <Text style={[styles.galleryBtnText, { color: colors.foreground }]}>
                Upload Screenshot
              </Text>
            </TouchableOpacity>
          </Animated.View>

          <Text style={[styles.brandNote, { color: colors.mutedForeground }]}>
            Works with Lowrance, Garmin, Humminbird, Simrad, Raymarine, Furuno & more
          </Text>
        </View>
      ) : (
        <View style={styles.analyzeSection}>
          <View style={[styles.imageContainer, { borderColor: colors.border }]}>
            <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />

            {/* Overlay action buttons */}
            <View style={styles.imageActions}>
              <TouchableOpacity
                style={[styles.overlayBtn, { backgroundColor: colors.secondary }]}
                onPress={openCamera}
                activeOpacity={0.8}
              >
                <Feather name="camera" size={14} color={colors.primary} />
                <Text style={[styles.overlayBtnText, { color: colors.primary }]}>Camera</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.overlayBtn, { backgroundColor: colors.secondary }]}
                onPress={openGallery}
                activeOpacity={0.8}
              >
                <Feather name="image" size={14} color={colors.primary} />
                <Text style={[styles.overlayBtnText, { color: colors.primary }]}>Gallery</Text>
              </TouchableOpacity>
            </View>
          </View>

          {!analysis && !loading && (
            <Animated.View style={animatedAnalyzeStyle}>
              <TouchableOpacity
                style={[styles.analyzeBtn, { backgroundColor: colors.primary }]}
                onPress={analyzeImage}
                activeOpacity={0.85}
              >
                <SonarPulse size={24} active={false} />
                <Text style={[styles.analyzeBtnText, { color: colors.primaryForeground }]}>
                  Analyze Sonar
                </Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {loading && (
            <View style={styles.loadingContainer}>
              <SonarPulse size={80} active />
              <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
                Reading your sonar...
              </Text>
              <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} />
            </View>
          )}

          {error && (
            <View style={[styles.errorBox, { backgroundColor: `${colors.destructive}18`, borderColor: `${colors.destructive}44` }]}>
              <Feather name="alert-circle" size={16} color={colors.destructive} />
              <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
            </View>
          )}

          {analysis && <AnalysisCard analysis={analysis} />}

          {analysis && (
            <TouchableOpacity
              style={[styles.newBtn, { borderColor: colors.border }]}
              onPress={() => {
                setImageUri(null);
                setImageBase64(null);
                setAnalysis(null);
                setError(null);
              }}
              activeOpacity={0.7}
            >
              <Feather name="plus" size={16} color={colors.mutedForeground} />
              <Text style={[styles.newBtnText, { color: colors.mutedForeground }]}>
                New analysis
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    gap: 12,
  },
  header: {
    alignItems: "center",
    gap: 2,
  },
  appName: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    letterSpacing: 0.3,
  },
  fullWidth: {
    width: "100%",
  },
  emptyState: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    marginTop: 2,
  },
  emptyDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 17,
    paddingHorizontal: 8,
  },
  cameraBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 30,
    marginTop: 6,
  },
  cameraBtnText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.2,
  },
  galleryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 30,
    borderWidth: 1,
  },
  galleryBtnText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  brandNote: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 16,
    marginTop: 4,
  },
  analyzeSection: {
    gap: 16,
  },
  imageContainer: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    position: "relative",
  },
  image: {
    width: "100%",
    height: 220,
  },
  imageActions: {
    position: "absolute",
    top: 10,
    right: 10,
    flexDirection: "row",
    gap: 6,
  },
  overlayBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  overlayBtnText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  analyzeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    borderRadius: 30,
  },
  analyzeBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  loadingContainer: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 20,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  newBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  newBtnText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
});
