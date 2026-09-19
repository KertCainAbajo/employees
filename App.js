import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { API_TOKEN, API_URL } from './src/config';

const COLORS = {
  navy: '#5b21b6',
  blue: '#7c3aed',
  blueLight: '#ede9fe',
  ink: '#2e1065',
  muted: '#756b8f',
  line: '#e9d5ff',
  background: '#faf7ff',
  white: '#ffffff',
  green: '#10b981',
  greenLight: '#d1fae5',
  red: '#dc2626',
  redLight: '#fee2e2',
};

const EMPTY_FORM = {
  firstname: '',
  middlename: '',
  lastname: '',
  position: '',
  department: '',
  email: '',
  phone: '',
};

const DEPARTMENT_OPTIONS = [
  'Human Resources',
  'Information Technology',
  'Finance and Accounting',
  'Marketing',
  'Sales',
  'Operations',
  'Customer Service',
  'Administration',
  'Engineering',
  'Research and Development',
  'Legal',
  'Other',
];

async function apiRequest(path = '', options = {}) {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const text = await response.text();
  let data;

  try {
    const jsonText = text.replace(/^\s*\/\*[\s\S]*?\*\/\s*/, '');
    data = jsonText ? JSON.parse(jsonText) : null;
  } catch {
    throw new Error('The server returned an invalid response. Check your PHP API.');
  }

  if (!response.ok || data?.status === 0) {
    throw new Error(data?.message || data?.error || `Request failed (${response.status})`);
  }

  return data;
}

function normalizeEmployee(employee) {
  return {
    ...employee,
    id: employee.id ?? employee.ID,
    firstname: employee.firstname ?? '',
    middlename: employee.middlename ?? '',
    lastname: employee.lastname ?? '',
    position: employee.position ?? '',
    department: employee.department ?? '',
    email: employee.email ?? '',
    phone: employee.phone ?? '',
  };
}

function employeeName(employee) {
  return [employee.firstname, employee.middlename, employee.lastname]
    .filter(Boolean)
    .join(' ')
    .trim() || 'Unnamed employee';
}

function initials(employee) {
  return [employee.firstname, employee.lastname]
    .filter(Boolean)
    .map((value) => value[0]?.toUpperCase())
    .join('') || '?';
}

function Toast({ toast, onClose }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(onClose, 3600);
    return () => clearTimeout(timer);
  }, [onClose, progress, toast.id]);

  const isError = toast.type === 'error';
  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.toast,
        isError ? styles.toastError : styles.toastSuccess,
        { opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }] },
      ]}
    >
      <View style={[styles.toastIcon, isError ? styles.toastIconError : styles.toastIconSuccess]}>
        <Text style={styles.toastIconText}>{isError ? '!' : 'OK'}</Text>
      </View>
      <View style={styles.toastCopy}>
        <Text style={styles.toastTitle}>{toast.title}</Text>
        <Text style={styles.toastMessage}>{toast.message}</Text>
      </View>
      <Pressable onPress={onClose} hitSlop={10}><Text style={styles.toastClose}>X</Text></Pressable>
    </Animated.View>
  );
}

export default function App() {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [formVisible, setFormVisible] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [query, setQuery] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  const showToast = useCallback((type, title, message) => {
    setToast({ id: Date.now(), type, title, message });
  }, []);

  const loadEmployees = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const data = await apiRequest();
      setEmployees(Array.isArray(data) ? data.map(normalizeEmployee) : []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const departments = useMemo(() => {
    return ['All', ...new Set(employees.map((employee) => employee.department).filter(Boolean))];
  }, [employees]);

  const completeProfiles = useMemo(() => {
    return employees.filter((employee) => employee.email && employee.phone && employee.position).length;
  }, [employees]);

  const visibleEmployees = useMemo(() => {
    const search = query.trim().toLowerCase();
    return employees.filter((employee) => {
      const matchesDepartment = departmentFilter === 'All' || employee.department === departmentFilter;
      const matchesSearch = !search || [employeeName(employee), employee.position, employee.department, employee.email, employee.phone]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(search);
      return matchesDepartment && matchesSearch;
    });
  }, [employees, query, departmentFilter]);

  function openCreate() {
    setEditingEmployee(null);
    setForm({ ...EMPTY_FORM });
    setFormVisible(true);
  }

  function openEdit(employee) {
    setEditingEmployee(employee);
    setForm({
      firstname: employee.firstname || '',
      middlename: employee.middlename || '',
      lastname: employee.lastname || '',
      position: employee.position || '',
      department: employee.department || '',
      email: employee.email || '',
      phone: employee.phone || '',
    });
    setSelectedEmployee(null);
    setFormVisible(true);
  }

  async function saveEmployee() {
    const required = ['firstname', 'lastname', 'position', 'department', 'email', 'phone'];
    if (required.some((field) => !form[field].trim())) {
      Alert.alert('Incomplete form', 'Please complete all required fields before saving.');
      return;
    }

    const wasEditing = Boolean(editingEmployee);
    setSaving(true);
    try {
      const path = wasEditing ? `?id=${encodeURIComponent(editingEmployee.id)}` : '';
      await apiRequest(path, {
        method: wasEditing ? 'PUT' : 'POST',
        body: JSON.stringify(form),
      });
      setEditingEmployee(null);
      setFormVisible(false);
      await loadEmployees(true);
      Alert.alert(wasEditing ? 'Employee updated' : 'Employee created', wasEditing ? 'Employee information was updated successfully.' : 'The new employee was added successfully.', [{ text: 'OK' }]);
    } catch (requestError) {
      Alert.alert('Save failed', requestError.message);
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(employee) {
    Alert.alert('Delete employee?', `Remove ${employeeName(employee)} from the directory?`, [
      { text: 'Keep employee', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeletingId(employee.id);
          try {
            await apiRequest(`?id=${encodeURIComponent(employee.id)}`, { method: 'DELETE' });
            setSelectedEmployee(null);
            await loadEmployees(true);
            Alert.alert('Employee deleted', `${employeeName(employee)} was removed successfully.`, [{ text: 'OK' }]);
          } catch (requestError) {
            Alert.alert('Delete failed', requestError.message, [{ text: 'OK' }]);
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ExpoStatusBar style="light" />
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <View style={styles.headerOrbOne} />
        <View style={styles.headerOrbTwo} />
        <View style={styles.headerTopRow}>
          <View>
            <Text style={styles.eyebrow}>PEOPLE DIRECTORY</Text>
            <Text style={styles.title}>Employee hub</Text>
            <Text style={styles.subtitle}>Manage your team with confidence.</Text>
          </View>
          <View style={styles.brandMark}><Text style={styles.brandMarkText}>ES</Text></View>
        </View>
        <Pressable style={({ pressed }) => [styles.addButton, pressed && styles.pressed]} onPress={openCreate}>
          <Text style={styles.addButtonPlus}>+</Text>
          <Text style={styles.addButtonText}>New employee</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        <View style={styles.statsRow}>
          <StatTile label="Total" value={employees.length} accent="blue" />
          <StatTile label="Teams" value={departments.length - 1} accent="purple" />
          <StatTile label="Complete" value={completeProfiles} accent="green" />
        </View>

        <View style={styles.searchBox}>
          <View style={styles.searchIcon}><View style={styles.searchHandle} /></View>
          <TextInput value={query} onChangeText={setQuery} placeholder="Search employees" placeholderTextColor="#9aa8bd" style={styles.searchInput} returnKeyType="search" />
          {query ? <Pressable onPress={() => setQuery('')}><Text style={styles.clearSearch}>X</Text></Pressable> : null}
        </View>

        <View style={styles.filterRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent} style={styles.filterScroll}>
            {departments.map((department) => (
              <Pressable key={department} onPress={() => setDepartmentFilter(department)} style={[styles.filterChip, departmentFilter === department && styles.filterChipActive]}>
                <Text style={[styles.filterText, departmentFilter === department && styles.filterTextActive]}>{department}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <View style={styles.errorBadge}><Text style={styles.errorBadgeText}>!</Text></View>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => loadEmployees()}><Text style={styles.retryText}>Retry</Text></Pressable>
          </View>
        ) : null}

        <View style={styles.sectionHeading}>
          <View><Text style={styles.sectionTitle}>{departmentFilter === 'All' ? 'All employees' : departmentFilter}</Text><Text style={styles.sectionSubtitle}>{visibleEmployees.length} profile{visibleEmployees.length === 1 ? '' : 's'} found</Text></View>
          <Text style={styles.sortLabel}>DIRECTORY</Text>
        </View>

        {loading ? (
          <View style={styles.centered}><ActivityIndicator size="large" color={COLORS.blue} /><Text style={styles.loadingText}>Loading directory...</Text></View>
        ) : (
          <FlatList
            data={visibleEmployees}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={visibleEmployees.length ? styles.list : styles.emptyList}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadEmployees(true)} tintColor={COLORS.blue} />}
            renderItem={({ item, index }) => <EmployeeCard employee={item} index={index} onPress={() => setSelectedEmployee(item)} />}
            ListEmptyComponent={<EmptyState hasSearch={Boolean(query || departmentFilter !== 'All')} onAdd={openCreate} />}
          />
        )}
      </View>

      {toast ? <Toast toast={toast} onClose={() => setToast(null)} /> : null}

      <Modal visible={formVisible} animationType="fade" transparent onRequestClose={() => setFormVisible(false)}>
        <EmployeeForm form={form} setForm={setForm} editing={Boolean(editingEmployee)} saving={saving} onClose={() => setFormVisible(false)} onSave={saveEmployee} />
      </Modal>

      <Modal visible={Boolean(selectedEmployee)} animationType="fade" transparent onRequestClose={() => setSelectedEmployee(null)}>
        {selectedEmployee ? <DetailView employee={selectedEmployee} deleting={deletingId === selectedEmployee.id} onClose={() => setSelectedEmployee(null)} onEdit={() => openEdit(selectedEmployee)} onDelete={() => confirmDelete(selectedEmployee)} /> : null}
      </Modal>
    </SafeAreaView>
  );
}

function StatTile({ label, value, accent }) {
  return (
    <View style={styles.statTile}>
      <View style={[styles.statDot, accent === 'purple' ? styles.statDotPurple : accent === 'green' ? styles.statDotGreen : null]} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function EmployeeCard({ employee, index, onPress }) {
  const animation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animation, { toValue: 1, duration: 420, delay: Math.min(index * 65, 260), easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [animation, index]);

  return (
    <Animated.View style={{ opacity: animation, transform: [{ translateY: animation.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}>
      <Pressable style={({ pressed }) => [styles.card, pressed && styles.cardPressed]} onPress={onPress}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{initials(employee)}</Text></View>
        <View style={styles.cardBody}>
          <Text style={styles.cardName} numberOfLines={1}>{employeeName(employee)}</Text>
          <Text style={styles.cardPosition} numberOfLines={1}>{employee.position || 'Position not set'}</Text>
          <View style={styles.departmentPill}><Text style={styles.departmentPillText}>{employee.department || 'No department'}</Text></View>
        </View>
        <View style={styles.cardArrow}><Text style={styles.chevron}>&gt;</Text></View>
      </Pressable>
    </Animated.View>
  );
}

function EmptyState({ hasSearch, onAdd }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIllustration}><View style={styles.emptyIllustrationInner}><Text style={styles.emptyIllustrationText}>ES</Text></View></View>
      <Text style={styles.emptyTitle}>{hasSearch ? 'No matches found' : 'Your directory is empty'}</Text>
      <Text style={styles.emptyText}>{hasSearch ? 'Try a different name or department.' : 'Create your first employee profile to get started.'}</Text>
      {!hasSearch ? <Pressable style={styles.emptyButton} onPress={onAdd}><Text style={styles.emptyButtonText}>Add first employee</Text></Pressable> : null}
    </View>
  );
}

function EmployeeForm({ form, setForm, editing, saving, onClose, onSave }) {
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const slide = useRef(new Animated.Value(0)).current;
  const [departmentOpen, setDepartmentOpen] = useState(false);
  const fields = [
    ['firstname', 'First name', true], ['middlename', 'Middle name', false], ['lastname', 'Last name', true],
    ['position', 'Position', true], ['department', 'Department', true], ['email', 'Email address', true], ['phone', 'Phone number', true],
  ];

  useEffect(() => {
    Animated.spring(slide, { toValue: 1, damping: 18, stiffness: 150, mass: 0.8, useNativeDriver: true }).start();
  }, [slide]);

  return (
    <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <Animated.View style={[styles.formSheet, { transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [420, 0] }) }] }]}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}>
          <View><Text style={styles.sheetKicker}>{editing ? 'UPDATE PROFILE' : 'NEW PROFILE'}</Text><Text style={styles.sheetTitle}>{editing ? 'Edit employee' : 'Add employee'}</Text><Text style={styles.sheetSubtitle}>Keep your directory information current.</Text></View>
          <Pressable style={styles.closeCircle} onPress={onClose}><Text style={styles.closeButton}>X</Text></Pressable>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
          {fields.map(([field, label, required]) => (
            <View style={styles.field} key={field}>
              <Text style={styles.label}>{label}{required ? ' *' : ''}</Text>
              {field === 'department' ? (
                <View>
                  <Pressable style={[styles.input, styles.selectInput]} onPress={() => setDepartmentOpen((current) => !current)}>
                    <Text style={form.department ? styles.selectValue : styles.selectPlaceholder}>{form.department || 'Choose a department'}</Text>
                    <Text style={styles.selectArrow}>{departmentOpen ? '^' : 'v'}</Text>
                  </Pressable>
                  {departmentOpen ? (
                    <View style={styles.dropdownMenu}>
                      <ScrollView style={styles.dropdownScroll} nestedScrollEnabled showsVerticalScrollIndicator keyboardShouldPersistTaps="handled">
                        {DEPARTMENT_OPTIONS.map((department) => (
                          <Pressable key={department} style={({ pressed }) => [styles.dropdownOption, form.department === department && styles.dropdownOptionSelected, pressed && styles.dropdownPressed]} onPress={() => { update('department', department); setDepartmentOpen(false); }}>
                            <Text style={[styles.dropdownOptionText, form.department === department && styles.dropdownOptionTextSelected]}>{department}</Text>
                            {form.department === department ? <Text style={styles.dropdownCheck}>OK</Text> : null}
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>
                  ) : null}
                </View>
              ) : (
                <TextInput value={form[field]} onChangeText={(value) => update(field, value)} placeholder={`Enter ${label.toLowerCase()}`} placeholderTextColor="#a2aec1" style={styles.input} keyboardType={field === 'email' ? 'email-address' : field === 'phone' ? 'phone-pad' : 'default'} autoCapitalize={field === 'email' ? 'none' : 'words'} />
              )}
            </View>
          ))}
          <Pressable style={({ pressed }) => [styles.primaryButton, saving && styles.disabledButton, pressed && styles.pressed]} onPress={onSave} disabled={saving}>
            {saving ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.primaryButtonText}>{editing ? 'Save changes' : 'Create employee'}</Text>}
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={onClose}><Text style={styles.secondaryButtonText}>Cancel</Text></Pressable>
        </ScrollView>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

function DetailView({ employee, deleting, onClose, onEdit, onDelete }) {
  const slide = useRef(new Animated.Value(0)).current;
  const details = [
    ['Position', employee.position], ['Department', employee.department], ['Email', employee.email],
    ['Phone', employee.phone], ['Middle name', employee.middlename], ['Created', employee.created_at],
  ];

  useEffect(() => {
    Animated.spring(slide, { toValue: 1, damping: 18, stiffness: 150, mass: 0.8, useNativeDriver: true }).start();
  }, [slide]);

  return (
    <View style={styles.modalOverlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <Animated.View style={[styles.detailSheet, { transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [360, 0] }) }] }]}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetHeader}>
          <View><Text style={styles.sheetKicker}>PROFILE OVERVIEW</Text><Text style={styles.sheetTitle}>Employee details</Text></View>
          <Pressable style={styles.closeCircle} onPress={onClose}><Text style={styles.closeButton}>X</Text></Pressable>
        </View>
        <View style={styles.profileHeader}>
          <View style={styles.largeAvatar}><Text style={styles.largeAvatarText}>{initials(employee)}</Text></View>
          <View style={styles.profileCopy}><Text style={styles.profileName}>{employeeName(employee)}</Text><Text style={styles.profilePosition}>{employee.position || 'No position assigned'}</Text><View style={styles.activeBadge}><View style={styles.activeDot} /><Text style={styles.activeText}>PROFILE ACTIVE</Text></View></View>
        </View>
        <View style={styles.detailsBox}>
          {details.map(([label, value]) => value ? <View style={styles.detailRow} key={label}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue} numberOfLines={2}>{value}</Text></View> : null)}
        </View>
        <View style={styles.actionRow}>
          <Pressable style={({ pressed }) => [styles.editButton, pressed && styles.pressed]} onPress={onEdit}><Text style={styles.editButtonText}>Edit profile</Text></Pressable>
          <Pressable style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]} onPress={onDelete} disabled={deleting}><Text style={styles.deleteButtonText}>{deleting ? 'Deleting...' : 'Delete'}</Text></Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.navy },
  header: { backgroundColor: COLORS.navy, paddingHorizontal: 22, paddingTop: 5, paddingBottom: 18, overflow: 'hidden' },
  headerOrbOne: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: '#7c3aed', right: -55, top: -70, opacity: 0.42 },
  headerOrbTwo: { position: 'absolute', width: 100, height: 100, borderRadius: 50, backgroundColor: '#a855f7', right: 55, top: 35, opacity: 0.25 },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  eyebrow: { color: '#8ebcff', fontSize: 10, fontWeight: '900', letterSpacing: 1.8, marginBottom: 8 },
  title: { color: COLORS.white, fontSize: 30, fontWeight: '900', letterSpacing: -0.7 },
  subtitle: { color: '#b8c6df', marginTop: 7, fontSize: 13 },
  brandMark: { width: 54, height: 54, borderRadius: 18, backgroundColor: '#a855f7', justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: '#7e22ce' },
  brandMarkText: { color: COLORS.white, fontSize: 17, fontWeight: '900', letterSpacing: 1 },
  addButton: { marginTop: 13, backgroundColor: COLORS.blue, borderRadius: 13, minHeight: 44, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', shadowColor: '#2e1065', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  addButtonPlus: { color: COLORS.white, fontSize: 23, fontWeight: '400', marginRight: 8, marginTop: -2 },
  addButtonText: { color: COLORS.white, fontWeight: '800', fontSize: 14 },
  content: { flex: 1, paddingHorizontal: 18, backgroundColor: COLORS.background },
  statsRow: { flexDirection: 'row', gap: 9, marginTop: -11, marginBottom: 10 },
  statTile: { flex: 1, backgroundColor: COLORS.white, borderRadius: 15, paddingHorizontal: 11, paddingVertical: 10, borderWidth: 1, borderColor: COLORS.line, shadowColor: '#10234b', shadowOpacity: 0.06, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  statDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.blue, marginBottom: 8 },
  statDotPurple: { backgroundColor: '#8b5cf6' },
  statDotGreen: { backgroundColor: COLORS.green },
  statValue: { color: COLORS.ink, fontSize: 21, fontWeight: '900' },
  statLabel: { color: COLORS.muted, fontSize: 11, fontWeight: '700', marginTop: 3 },
  searchBox: { backgroundColor: COLORS.white, borderRadius: 14, height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderWidth: 1, borderColor: COLORS.line },
  searchIcon: { width: 19, height: 19, borderRadius: 10, borderWidth: 2, borderColor: '#8b5cf6', marginRight: 13 },
  searchHandle: { position: 'absolute', width: 8, height: 2, borderRadius: 2, backgroundColor: '#8b5cf6', right: -6, bottom: -3, transform: [{ rotate: '45deg' }] },
  searchInput: { flex: 1, color: COLORS.ink, fontSize: 14 },
  clearSearch: { color: COLORS.muted, fontWeight: '900', padding: 5 },
  filterRow: { height: 38, marginTop: 8, marginBottom: 10 },
  filterScroll: { height: 38, flexGrow: 0 },
  filterContent: { gap: 8, paddingRight: 8, alignItems: 'center' },
  filterChip: { height: 34, paddingHorizontal: 14, borderRadius: 17, justifyContent: 'center', backgroundColor: '#edf2f9' },
  filterChipActive: { backgroundColor: COLORS.navy },
  filterText: { color: COLORS.muted, fontSize: 12, fontWeight: '800' },
  filterTextActive: { color: COLORS.white },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 },
  sectionTitle: { color: COLORS.ink, fontSize: 19, fontWeight: '900' },
  sectionSubtitle: { color: COLORS.muted, fontSize: 12, marginTop: 3 },
  sortLabel: { color: '#9baac0', fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  list: { paddingBottom: 28 },
  card: { backgroundColor: COLORS.white, borderRadius: 17, padding: 14, marginBottom: 11, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.line, shadowColor: '#10234b', shadowOpacity: 0.045, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  cardPressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  avatar: { width: 51, height: 51, borderRadius: 17, backgroundColor: COLORS.blueLight, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#2459bd', fontSize: 16, fontWeight: '900' },
  cardBody: { flex: 1, marginLeft: 13 },
  cardName: { color: COLORS.ink, fontSize: 16, fontWeight: '900' },
  cardPosition: { color: '#62728d', marginTop: 3, fontSize: 12 },
  departmentPill: { alignSelf: 'flex-start', backgroundColor: '#eef4ff', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, marginTop: 6 },
  departmentPillText: { color: COLORS.blue, fontSize: 10, fontWeight: '900' },
  cardArrow: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#f2f5fa', justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  chevron: { color: '#72819a', fontSize: 19, fontWeight: '800' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: COLORS.muted, fontSize: 12, marginTop: 10 },
  errorBox: { backgroundColor: '#fff2f2', padding: 12, borderRadius: 13, marginBottom: 12, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#ffd5d5' },
  errorBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: COLORS.redLight, justifyContent: 'center', alignItems: 'center', marginRight: 9 },
  errorBadgeText: { color: COLORS.red, fontWeight: '900' },
  errorText: { flex: 1, color: '#a52b2b', fontSize: 12 },
  retryText: { color: '#a51d1d', fontWeight: '900', marginLeft: 10 },
  emptyList: { flexGrow: 1 },
  emptyState: { alignItems: 'center', paddingHorizontal: 28, paddingTop: 28 },
  emptyIllustration: { width: 82, height: 82, borderRadius: 28, backgroundColor: COLORS.blueLight, justifyContent: 'center', alignItems: 'center', marginBottom: 18 },
  emptyIllustrationInner: { width: 52, height: 52, borderRadius: 18, borderWidth: 2, borderColor: COLORS.blue, justifyContent: 'center', alignItems: 'center' },
  emptyIllustrationText: { color: COLORS.blue, fontWeight: '900', fontSize: 16 },
  emptyTitle: { color: COLORS.ink, fontSize: 19, fontWeight: '900' },
  emptyText: { color: COLORS.muted, textAlign: 'center', marginTop: 7, lineHeight: 20, fontSize: 13 },
  emptyButton: { backgroundColor: COLORS.blue, paddingHorizontal: 17, paddingVertical: 12, borderRadius: 11, marginTop: 18, shadowColor: '#2e1065', shadowOpacity: 0.16, shadowRadius: 7, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  emptyButtonText: { color: COLORS.white, fontWeight: '800', fontSize: 13 },
  toast: { position: 'absolute', top: 16, left: 18, right: 18, borderRadius: 15, padding: 13, flexDirection: 'row', alignItems: 'center', zIndex: 30, elevation: 10, shadowColor: '#08142e', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
  toastSuccess: { backgroundColor: COLORS.navy },
  toastError: { backgroundColor: '#7f1d1d' },
  toastIcon: { width: 34, height: 34, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  toastIconSuccess: { backgroundColor: '#2459bd' },
  toastIconError: { backgroundColor: '#b91c1c' },
  toastIconText: { color: COLORS.white, fontWeight: '900', fontSize: 11 },
  toastCopy: { flex: 1, marginLeft: 10 },
  toastTitle: { color: COLORS.white, fontWeight: '900', fontSize: 13 },
  toastMessage: { color: '#d5def0', fontSize: 11, marginTop: 2 },
  toastClose: { color: '#cbd5e1', fontWeight: '900', padding: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(8, 20, 46, .62)', justifyContent: 'flex-end' },
  formSheet: { backgroundColor: COLORS.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '94%' },
  detailSheet: { backgroundColor: COLORS.background, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 28 },
  sheetHandle: { width: 42, height: 5, borderRadius: 4, backgroundColor: '#c8d2e2', alignSelf: 'center', marginTop: 10 },
  sheetHeader: { paddingHorizontal: 21, paddingTop: 17, paddingBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  sheetKicker: { color: COLORS.blue, fontSize: 9, fontWeight: '900', letterSpacing: 1.4, marginBottom: 5 },
  sheetTitle: { color: COLORS.ink, fontSize: 22, fontWeight: '900' },
  sheetSubtitle: { color: COLORS.muted, fontSize: 12, marginTop: 4 },
  closeCircle: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#e9eef6', justifyContent: 'center', alignItems: 'center' },
  closeButton: { color: '#63728c', fontSize: 12, fontWeight: '900' },
  formContent: { paddingHorizontal: 21, paddingTop: 3, paddingBottom: 35 },
  field: { marginBottom: 12 },
  label: { color: '#42526d', fontSize: 11, fontWeight: '900', marginBottom: 6 },
  input: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: '#dce4ef', borderRadius: 12, paddingHorizontal: 13, height: 48, color: COLORS.ink, fontSize: 14 },
  selectInput: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectValue: { color: COLORS.ink, fontSize: 14, flex: 1 },
  selectPlaceholder: { color: '#a2aec1', fontSize: 14, flex: 1 },
  selectArrow: { color: COLORS.blue, fontSize: 16, fontWeight: '900', marginLeft: 10 },
  dropdownMenu: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: '#d8c5f7', borderRadius: 12, marginTop: 6, overflow: 'hidden', shadowColor: '#2e1065', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  dropdownScroll: { maxHeight: 180 },
  dropdownOption: { minHeight: 42, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#f1edfa' },
  dropdownOptionSelected: { backgroundColor: COLORS.blueLight },
  dropdownPressed: { opacity: 0.7 },
  dropdownOptionText: { color: COLORS.ink, fontSize: 13, flex: 1 },
  dropdownOptionTextSelected: { color: COLORS.blue, fontWeight: '900' },
  dropdownCheck: { color: COLORS.blue, fontSize: 10, fontWeight: '900' },
  primaryButton: { backgroundColor: COLORS.blue, height: 51, borderRadius: 13, justifyContent: 'center', alignItems: 'center', marginTop: 8, shadowColor: '#2e1065', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  primaryButtonText: { color: COLORS.white, fontWeight: '900', fontSize: 14 },
  disabledButton: { opacity: 0.6 },
  secondaryButton: { height: 45, justifyContent: 'center', alignItems: 'center' },
  secondaryButtonText: { color: '#61718b', fontWeight: '800', fontSize: 13 },
  profileHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 21, paddingBottom: 18 },
  largeAvatar: { width: 72, height: 72, borderRadius: 24, backgroundColor: COLORS.blueLight, justifyContent: 'center', alignItems: 'center' },
  largeAvatarText: { color: '#2459bd', fontSize: 25, fontWeight: '900' },
  profileCopy: { flex: 1, marginLeft: 14 },
  profileName: { color: COLORS.ink, fontSize: 20, fontWeight: '900' },
  profilePosition: { color: COLORS.muted, marginTop: 4, fontSize: 13 },
  activeBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  activeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.green, marginRight: 5 },
  activeText: { color: '#059669', fontSize: 9, fontWeight: '900', letterSpacing: 0.7 },
  detailsBox: { backgroundColor: COLORS.white, marginHorizontal: 21, borderRadius: 16, paddingHorizontal: 13, borderWidth: 1, borderColor: COLORS.line },
  detailRow: { paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#f0f3f8' },
  detailLabel: { color: '#7b8aa2', fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.7 },
  detailValue: { color: COLORS.ink, fontSize: 14, marginTop: 4, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 10, marginHorizontal: 21, marginTop: 17 },
  editButton: { flex: 1, backgroundColor: COLORS.blue, borderRadius: 12, height: 49, justifyContent: 'center', alignItems: 'center' },
  editButtonText: { color: COLORS.white, fontWeight: '900', fontSize: 13 },
  deleteButton: { flex: 0.65, backgroundColor: COLORS.white, borderRadius: 12, height: 49, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#c4b5fd' },
  deleteButtonText: { color: '#6d28d9', fontWeight: '900', fontSize: 13 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
});
