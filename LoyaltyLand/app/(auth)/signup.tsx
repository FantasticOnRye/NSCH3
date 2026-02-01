import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Link } from 'expo-router';
import { Mail, Lock, User, Building2, MapPin, ArrowLeft } from 'lucide-react-native';
import { signUp } from '../../services/firebaseAuth';
import SelectStoreView, { Organization } from '../../components/SelectStoreView';
import { ACCENT_COLOR } from '../../constants/theme';

type AccountType = 'personal' | 'business';
type SignupStep = 1 | 2;

export default function SignupScreen() {
  const [step, setStep] = useState<SignupStep>(1);
  const [accountType, setAccountType] = useState<AccountType>('personal');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [location, setLocation] = useState('');
  const [selectedStore, setSelectedStore] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleNextStep = () => {
    setError('');

    if (!email || !password) {
      setError('Please fill in email and password');
      return;
    }

    if (accountType === 'personal' && !username) {
      setError('Please enter a username');
      return;
    }

    if (accountType === 'business' && (!businessName || !location)) {
      setError('Please fill in business name and location');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    // Personal accounts go to Step 2 (store selection)
    // Business accounts complete immediately
    if (accountType === 'personal') {
      setStep(2);
    } else {
      handleSignup();
    }
  };

  const handleSignup = async () => {
    setError('');

    // Personal accounts must select a preferred store
    if (accountType === 'personal' && !selectedStore) {
      setError('Please select a preferred store to continue');
      return;
    }

    setIsLoading(true);

    try {
      if (accountType === 'personal') {
        await signUp(email, password, 'personal', {
          username,
          email,
          preferredStore: selectedStore?.id,
        });
      } else {
        await signUp(email, password, 'business', { businessName, location, email });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setStep(1);
    setError('');
  };

  // Step 2: Store Selection (Personal accounts only)
  if (step === 2) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.step2Container}>
          {/* Back Button */}
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <ArrowLeft size={24} color="#1a1a1a" />
          </TouchableOpacity>

          {/* Step Indicator */}
          <View style={styles.stepIndicator}>
            <View style={[styles.stepDot, styles.stepDotCompleted]} />
            <View style={styles.stepLine} />
            <View style={[styles.stepDot, styles.stepDotActive]} />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {/* Store Selection */}
          <SelectStoreView
            selectedStoreId={selectedStore?.id || null}
            onSelectStore={setSelectedStore}
            title="Choose Your Preferred Store"
            subtitle="This helps us personalize your experience. You can change this later."
          />

          {/* Complete Signup Button */}
          <TouchableOpacity
            style={[styles.button, !selectedStore && styles.buttonDisabled]}
            onPress={handleSignup}
            disabled={isLoading || !selectedStore}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Complete Signup</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // Step 1: Account Details
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join LoyaltyLand today</Text>

          {/* Step Indicator for Personal */}
          {accountType === 'personal' && (
            <View style={styles.stepIndicator}>
              <View style={[styles.stepDot, styles.stepDotActive]} />
              <View style={styles.stepLine} />
              <View style={styles.stepDot} />
            </View>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {/* Account Type Toggle */}
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                accountType === 'personal' && styles.toggleButtonActive,
              ]}
              onPress={() => setAccountType('personal')}
            >
              <User
                size={18}
                color={accountType === 'personal' ? '#fff' : '#666'}
              />
              <Text
                style={[
                  styles.toggleText,
                  accountType === 'personal' && styles.toggleTextActive,
                ]}
              >
                Personal
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                accountType === 'business' && styles.toggleButtonActive,
              ]}
              onPress={() => setAccountType('business')}
            >
              <Building2
                size={18}
                color={accountType === 'business' ? '#fff' : '#666'}
              />
              <Text
                style={[
                  styles.toggleText,
                  accountType === 'business' && styles.toggleTextActive,
                ]}
              >
                Business
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputContainer}>
            <Mail size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputContainer}>
            <Lock size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          {accountType === 'personal' ? (
            <View style={styles.inputContainer}>
              <User size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Username"
                placeholderTextColor="#999"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />
            </View>
          ) : (
            <>
              <View style={styles.inputContainer}>
                <Building2 size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Business Name"
                  placeholderTextColor="#999"
                  value={businessName}
                  onChangeText={setBusinessName}
                />
              </View>
              <View style={styles.inputContainer}>
                <MapPin size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Business Address"
                  placeholderTextColor="#999"
                  value={location}
                  onChangeText={setLocation}
                />
              </View>
            </>
          )}

          <TouchableOpacity
            style={styles.button}
            onPress={handleNextStep}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>
                {accountType === 'personal' ? 'Next' : 'Create Account'}
              </Text>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text style={styles.link}>Sign In</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  step2Container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 24,
  },
  backButton: {
    marginBottom: 20,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#e0e0e0',
  },
  stepDotActive: {
    backgroundColor: ACCENT_COLOR,
  },
  stepDotCompleted: {
    backgroundColor: '#22c55e',
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
  },
  error: {
    color: '#dc2626',
    marginBottom: 16,
    textAlign: 'center',
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  toggleButtonActive: {
    backgroundColor: ACCENT_COLOR,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  toggleTextActive: {
    color: '#fff',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 52,
    fontSize: 16,
    color: '#1a1a1a',
  },
  button: {
    backgroundColor: ACCENT_COLOR,
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: '#ffb3bb',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: {
    color: '#666',
    fontSize: 14,
  },
  link: {
    color: ACCENT_COLOR,
    fontSize: 14,
    fontWeight: '600',
  },
});
