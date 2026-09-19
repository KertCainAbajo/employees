<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once 'connection.php';
$db = new dbObj();
$connection = $db->getConnstring();
$method = $_SERVER['REQUEST_METHOD'];
$id = isset($_GET['id']) ? (int) $_GET['id'] : 0;

function respond(array $data, int $status = 200): void {
    http_response_code($status);
    echo json_encode($data);
    exit;
}

function requestData(): array {
    $data = json_decode(file_get_contents('php://input'), true);
    return is_array($data) ? $data : [];
}

function requiredFields(array $data): bool {
    foreach (['firstname', 'lastname', 'position', 'department', 'email', 'phone'] as $field) {
        if (!isset($data[$field]) || trim((string) $data[$field]) === '') return false;
    }
    return true;
}

if ($method === 'GET') {
    if ($id > 0) {
        $stmt = $connection->prepare('SELECT * FROM employees WHERE id = ?');
        $stmt->bind_param('i', $id);
        $stmt->execute();
        $result = $stmt->get_result();
        $employee = $result->fetch_assoc();
        respond($employee ?: ['message' => 'Employee not found'], $employee ? 200 : 404);
    }

    $search = trim($_GET['name'] ?? '');
    $department = trim($_GET['department'] ?? '');
    if ($search !== '') {
        $like = '%' . $search . '%';
        $stmt = $connection->prepare('SELECT * FROM employees WHERE firstname LIKE ? OR lastname LIKE ? ORDER BY id DESC');
        $stmt->bind_param('ss', $like, $like);
    } elseif ($department !== '') {
        $like = '%' . $department . '%';
        $stmt = $connection->prepare('SELECT * FROM employees WHERE department LIKE ? ORDER BY id DESC');
        $stmt->bind_param('s', $like);
    } else {
        $stmt = $connection->prepare('SELECT * FROM employees ORDER BY id DESC');
    }
    $stmt->execute();
    $result = $stmt->get_result();
    $employees = [];
    while ($row = $result->fetch_assoc()) $employees[] = $row;
    respond($employees);
}

if ($method === 'POST' || $method === 'PUT') {
    $data = requestData();
    if (!requiredFields($data)) respond(['message' => 'Please provide all required employee fields.'], 422);

    $firstname = trim($data['firstname']);
    $middlename = trim($data['middlename'] ?? '');
    $lastname = trim($data['lastname']);
    $position = trim($data['position']);
    $department = trim($data['department']);
    $email = trim($data['email']);
    $phone = trim($data['phone']);

    if ($method === 'POST') {
        $stmt = $connection->prepare('INSERT INTO employees (firstname, middlename, lastname, position, department, email, phone) VALUES (?, ?, ?, ?, ?, ?, ?)');
        $stmt->bind_param('sssssss', $firstname, $middlename, $lastname, $position, $department, $email, $phone);
        $success = $stmt->execute();
        respond(['status' => $success ? 1 : 0, 'message' => $success ? 'Employee added successfully' : 'Employee addition failed'], $success ? 201 : 400);
    }

    if ($id <= 0) respond(['message' => 'A valid employee id is required.'], 400);
    $stmt = $connection->prepare('UPDATE employees SET firstname = ?, middlename = ?, lastname = ?, position = ?, department = ?, email = ?, phone = ? WHERE id = ?');
    $stmt->bind_param('sssssssi', $firstname, $middlename, $lastname, $position, $department, $email, $phone, $id);
    $success = $stmt->execute();
    respond(['status' => $success ? 1 : 0, 'message' => $success ? 'Employee updated successfully' : 'Employee update failed'], $success ? 200 : 400);
}

if ($method === 'DELETE') {
    if ($id <= 0) respond(['message' => 'A valid employee id is required.'], 400);
    $stmt = $connection->prepare('DELETE FROM employees WHERE id = ?');
    $stmt->bind_param('i', $id);
    $success = $stmt->execute();
    respond(['status' => $success ? 1 : 0, 'message' => $success ? 'Employee deleted successfully' : 'Employee deletion failed'], $success ? 200 : 400);
}

respond(['message' => 'Method not allowed'], 405);
?>
